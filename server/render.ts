import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { JobManifest } from '../src/shared/schemas';
import { videoSlugFromFolder } from '../src/shared/schemas';
import type { TranscriptPage } from '../src/video/types';
import { exists, readProject, videoPaths } from './fs-store';
import { RENDERS, ROOT } from './paths';

let bundlePromise: Promise<string> | null = null;
const getBundle = () =>
	(bundlePromise ??= bundle({
		entryPoint: resolve(ROOT, 'src/remotion/index.ts'),
		publicDir: resolve(ROOT, 'public'),
	}));

export const runRender = async (job: JobManifest, update: (patch: Partial<JobManifest>) => Promise<void>) => {
	if (!job.projectSlug) throw new Error('Render job is missing its project.');
	const project = await readProject(job.projectSlug);
	let transcriptPages: TranscriptPage[] = [];
	let videoSrc: string | undefined;
	const videoSlug = videoSlugFromFolder(project.template.videoFolder) ?? project.videoSlug;
	if (videoSlug) {
		const paths = videoPaths(videoSlug);
		if (!(await exists(paths.video))) throw new Error(`Source video '${videoSlug}' is missing.`);
		videoSrc = `${process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 4174}`}/api/videos/${encodeURIComponent(videoSlug)}/file`;
		if (await exists(paths.tokens))
			transcriptPages = JSON.parse(await readFile(paths.tokens, 'utf8')) as TranscriptPage[];
	} else if (project.template.videoBased) {
		throw new Error('This video-based project does not have a source video selected.');
	}

	await update({ stage: 'bundling', progress: 0.02 });
	const serveUrl = await getBundle();
	const inputProps = { template: project.template, videoSrc, transcriptPages, mediaMode: 'render' as const };
	const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
	await update({ stage: 'preparing-render', progress: 0.04 });
	const composition = await selectComposition({ serveUrl, id: 'project-render', inputProps, browserExecutable });
	const outputDirectory = resolve(RENDERS, job.projectSlug);
	await mkdir(outputDirectory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const outputPath = resolve(outputDirectory, `${timestamp}-${job.id}.mp4`);
	await renderMedia({
		serveUrl,
		composition,
		inputProps,
		codec: 'h264',
		outputLocation: outputPath,
		browserExecutable,
		overwrite: true,
		onProgress: ({ progress }) => {
			void update({ stage: 'rendering', progress: 0.05 + progress * 0.94 });
		},
	});
	return { outputPath };
};
