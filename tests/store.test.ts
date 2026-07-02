import { mkdir, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../src/shared/defaults';
import { videoFolderForSlug } from '../src/shared/schemas';
import {
	createProject,
	readProject,
	removeProject,
	removeVideo,
	updateProject,
	videoDirectory,
	videoPaths,
} from '../server/fs-store';
import { PROJECTS, VIDEOS, assertInside } from '../server/paths';

describe.sequential('filesystem stores', () => {
	it('prevents paths from escaping a data root', () => {
		expect(() => assertInside(`${PROJECTS}/../escape`, PROJECTS)).toThrow();
	});
	it('creates, updates, renames, and deletes a project atomically', async () => {
		const slug = `test-project-${Date.now()}`;
		const renamed = `${slug}-renamed`;
		try {
			await createProject(slug, createDefaultProject('Original'));
			expect((await readProject(slug)).name).toBe('Original');
			await updateProject(slug, renamed, { ...createDefaultProject('Updated'), videoSlug: null });
			expect((await readProject(renamed)).name).toBe('Updated');
			await removeProject(renamed);
			await expect(readProject(renamed)).rejects.toBeTruthy();
		} finally {
			await rm(`${PROJECTS}/${slug}`, { recursive: true, force: true });
			await rm(`${PROJECTS}/${renamed}`, { recursive: true, force: true });
		}
	});
	it('refuses to delete a video referenced by a project', async () => {
		const id = Date.now();
		const videoSlug = `test-video-${id}`;
		const projectSlug = `test-reference-${id}`;
		try {
			await mkdir(videoDirectory(videoSlug), { recursive: true });
			await writeFile(videoPaths(videoSlug).video, 'not-a-real-mp4');
			const project = createDefaultProject('Reference');
			await createProject(projectSlug, {
				...project,
				videoSlug: null,
				template: { ...project.template, videoFolder: videoFolderForSlug(videoSlug) },
			});
			await expect(removeVideo(videoSlug)).rejects.toMatchObject({ code: 'VIDEO_IN_USE' });
		} finally {
			await rm(`${PROJECTS}/${projectSlug}`, { recursive: true, force: true });
			await rm(`${VIDEOS}/${videoSlug}`, { recursive: true, force: true });
		}
	});
});
