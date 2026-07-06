import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { JobManifest } from '../src/shared/schemas';
import { videoSlugFromFolder } from '../src/shared/schemas';
import type { TranscriptPage } from '../src/video/types';
import { deliverRender } from './delivery';
import { exists, readProject, videoPaths } from './fs-store';
import { RENDERS, ROOT } from './paths';

const createProgressReporter = (
	update: (patch: Partial<JobManifest>) => Promise<void>,
	stage: string,
	mapProgress: (progress: number) => number
) => {
	let latestProgress: number | undefined;
	let timer: NodeJS.Timeout | undefined;
	let pendingWrite = Promise.resolve();
	let writeError: unknown;

	const writeLatest = () => {
		if (latestProgress === undefined) return;
		const progress = latestProgress;
		latestProgress = undefined;
		pendingWrite = pendingWrite.then(() => update({ stage, progress })).catch((error) => {
			writeError ??= error;
		});
	};

	return {
		report(progress: number) {
			latestProgress = mapProgress(progress);
			if (timer) return;
			timer = setTimeout(() => {
				timer = undefined;
				writeLatest();
			}, 500);
		},
		async flush() {
			if (timer) clearTimeout(timer);
			timer = undefined;
			writeLatest();
			await pendingWrite;
			if (writeError) throw writeError;
		},
	};
};

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
	console.info('[render] stage=bundling', { jobId: job.id, projectSlug: job.projectSlug });
	const serveUrl = await bundle({
		entryPoint: resolve(ROOT, 'src/remotion/index.ts'),
		onProgress: () => undefined,
		publicDir: resolve(ROOT, 'public'),
	});
	const inputProps = { template: project.template, videoSrc, transcriptPages, mediaMode: 'render' as const };
	const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
	await update({ stage: 'preparing-render', progress: 0.04 });
	console.info('[render] stage=preparing-render', { jobId: job.id, hasBrowserExecutable: Boolean(browserExecutable) });
	const composition = await selectComposition({ serveUrl, id: 'project-render', inputProps, browserExecutable });
	const outputDirectory = resolve(RENDERS, job.projectSlug);
	await mkdir(outputDirectory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const outputPath = resolve(outputDirectory, `${timestamp}-${job.id}.mp4`);
	const renderProgress = createProgressReporter(update, 'rendering', (progress) => 0.05 + progress * 0.94);
	console.info('[render] stage=rendering', { jobId: job.id });
	await renderMedia({
		serveUrl,
		composition,
		inputProps,
		codec: 'h264',
		outputLocation: outputPath,
		browserExecutable,
		overwrite: true,
		onProgress: ({ progress }) => {
			renderProgress.report(progress);
		},
	});
	await renderProgress.flush();
	await update({ stage: 'delivering', progress: 0.98 });
	console.info('[render] stage=delivering', { jobId: job.id });
	const deliveryProgress = createProgressReporter(update, 'uploading-to-drive', (progress) => 0.985 + progress * 0.0001);
	const delivery = await deliverRender({
		email: job.recipientEmail,
		filePath: outputPath,
		onProgress: (progress) => {
			deliveryProgress.report(progress.percent);
		},
	});
	await deliveryProgress.flush();
	console.info('[render] delivery result', {
		jobId: job.id,
		status: delivery.status,
		driveConfigured: delivery.driveConfigured,
		emailConfigured: delivery.emailConfigured,
		emailSent: delivery.emailSent,
	});
	return {
		deliveryError: delivery.driveError ?? delivery.emailError,
		deliveryStatus: delivery.status,
		driveConfigured: delivery.driveConfigured,
		driveLink: delivery.driveLink,
		driveName: delivery.driveName,
		emailConfigured: delivery.emailConfigured,
		emailError: delivery.emailError,
		emailSent: delivery.emailSent,
		fileId: delivery.fileId,
		outputPath,
		recipientEmail: delivery.emailTo,
	};
};
