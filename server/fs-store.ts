import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectDocumentSchema, slugSchema, videoSlugFromFolder, type ProjectDocument } from '../src/shared/schemas';
import { PROJECTS, RENDERS, ROOT, RUNTIME, UPLOADS, VIDEOS, assertInside } from './paths';

const RETRYABLE_FILE_ERRORS = new Set(['EACCES', 'EBUSY', 'EPERM']);
const FILE_OPERATION_ATTEMPTS = 9;

const wait = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));

export const renameWithRetry = async (source: string, target: string) => {
	for (let attempt = 0; ; attempt += 1) {
		try {
			await rename(source, target);
			return;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (!code || !RETRYABLE_FILE_ERRORS.has(code) || attempt >= FILE_OPERATION_ATTEMPTS - 1) throw error;
			const delay = Math.min(40 * 2 ** attempt, 1000);
			console.warn('[fs] rename temporarily blocked; retrying', {
				attempt: attempt + 2,
				code,
				delay,
				source,
				target,
			});
			await wait(delay);
		}
	}
};

export const exists = async (path: string) =>
	access(path)
		.then(() => true)
		.catch(() => false);

export const ensureDataDirectories = async () => {
	await Promise.all([PROJECTS, VIDEOS, RENDERS, RUNTIME, UPLOADS].map((dir) => mkdir(dir, { recursive: true })));
};

export const atomicWriteJson = async (target: string, value: unknown) => {
	const temporary = `${target}.${randomUUID()}.tmp`;
	await mkdir(resolve(target, '..'), { recursive: true });
	try {
		await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
		await renameWithRetry(temporary, target);
	} finally {
		await rm(temporary, { force: true }).catch((error) => {
			console.warn('[fs] could not remove temporary JSON file', { temporary, error });
		});
	}
};

export const readJson = async <T>(target: string): Promise<T> => JSON.parse(await readFile(target, 'utf8')) as T;

export const projectDirectory = (slug: string) => assertInside(resolve(PROJECTS, slugSchema.parse(slug)), PROJECTS);
export const projectFile = (slug: string) => resolve(projectDirectory(slug), 'template.json');
export const videoDirectory = (slug: string) => assertInside(resolve(VIDEOS, slugSchema.parse(slug)), VIDEOS);
export const videoPaths = (slug: string) => {
	const dir = videoDirectory(slug);
	return {
		dir,
		video: resolve(dir, 'video.mp4'),
		preview: resolve(dir, 'preview.mp4'),
		audio: resolve(dir, 'audio.wav'),
		captions: resolve(dir, 'captions.json'),
		tokens: resolve(dir, 'tokens.json'),
	};
};

export const readProject = async (slug: string): Promise<ProjectDocument> =>
	projectDocumentSchema.parse(await readJson(projectFile(slug)));

export const listProjects = async () => {
	await ensureDataDirectories();
	const entries = await readdir(PROJECTS, { withFileTypes: true });
	const projects = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map(async (entry) => {
				try {
					const document = await readProject(entry.name);
					const fileStats = await stat(projectFile(entry.name));
					const videoSlug = videoSlugFromFolder(document.template.videoFolder) ?? document.videoSlug;
					return { slug: entry.name, ...document, videoSlug, updatedAt: fileStats.mtime.toISOString() };
				} catch {
					return null;
				}
			})
	);
	return projects
		.filter((item): item is NonNullable<typeof item> => item !== null)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createProject = async (slug: string, document: ProjectDocument) => {
	slugSchema.parse(slug);
	const parsed = projectDocumentSchema.parse(document);
	if (await exists(projectDirectory(slug)))
		throw Object.assign(new Error('A project with this slug already exists.'), { code: 'PROJECT_EXISTS', status: 409 });
	await mkdir(projectDirectory(slug), { recursive: false });
	await atomicWriteJson(projectFile(slug), parsed);
	return parsed;
};

export const updateProject = async (slug: string, nextSlug: string, document: ProjectDocument) => {
	const parsed = projectDocumentSchema.parse(document);
	if (!(await exists(projectFile(slug))))
		throw Object.assign(new Error('Project not found.'), { code: 'PROJECT_NOT_FOUND', status: 404 });
	slugSchema.parse(nextSlug);
	if (nextSlug !== slug && (await exists(projectDirectory(nextSlug))))
		throw Object.assign(new Error('The new project slug is already in use.'), { code: 'PROJECT_EXISTS', status: 409 });
	await atomicWriteJson(projectFile(slug), parsed);
	if (nextSlug !== slug) await rename(projectDirectory(slug), projectDirectory(nextSlug));
	return { slug: nextSlug, ...parsed };
};

export const removeProject = async (slug: string) => {
	if (!(await exists(projectFile(slug))))
		throw Object.assign(new Error('Project not found.'), { code: 'PROJECT_NOT_FOUND', status: 404 });
	await rm(projectDirectory(slug), { recursive: true });
};

export const listVideos = async () => {
	await ensureDataDirectories();
	const entries = await readdir(VIDEOS, { withFileTypes: true });
	const videos = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map(async (entry) => {
				const paths = videoPaths(entry.name);
				if (!(await exists(paths.video))) return null;
				const fileStats = await stat(paths.video);
				const hasPreview = await exists(paths.preview);
				return {
					slug: entry.name,
					sizeBytes: fileStats.size,
					updatedAt: fileStats.mtime.toISOString(),
					hasPreview,
					hasAudio: await exists(paths.audio),
					hasCaptions: await exists(paths.captions),
					hasTokens: await exists(paths.tokens),
					previewUrl: `/api/videos/${encodeURIComponent(entry.name)}/${hasPreview ? 'preview' : 'file'}`,
				};
			})
	);
	return videos
		.filter((item): item is NonNullable<typeof item> => item !== null)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const findVideoReferences = async (slug: string) =>
	(await listProjects())
		.filter((project) => (videoSlugFromFolder(project.template.videoFolder) ?? project.videoSlug) === slug)
		.map((project) => ({ slug: project.slug, name: project.name }));

export const removeVideo = async (slug: string) => {
	const references = await findVideoReferences(slug);
	if (references.length)
		throw Object.assign(new Error(`Video is used by: ${references.map((item) => item.name).join(', ')}`), {
			code: 'VIDEO_IN_USE',
			status: 409,
			details: references,
		});
	if (!(await exists(videoPaths(slug).video)))
		throw Object.assign(new Error('Video not found.'), { code: 'VIDEO_NOT_FOUND', status: 404 });
	await rm(videoDirectory(slug), { recursive: true });
};

export const publicRoot = ROOT;
