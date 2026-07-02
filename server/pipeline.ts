import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTikTokStyleCaptions } from '@remotion/captions';
import {
	downloadWhisperModel,
	installWhisperCpp,
	toCaptions,
	transcribe,
	type WhisperModel,
} from '@remotion/install-whisper-cpp';
import type { JobManifest } from '../src/shared/schemas';
import { videoPaths } from './fs-store';

const WHISPER_CPP_VERSION = '1.5.5';
const model = (process.env.WHISPER_MODEL || 'medium.en') as WhisperModel;
const cacheRoot = process.env.LOCALAPPDATA || resolve(homedir(), '.cache', 'remotion-whisper');
const whisperPath = resolve(cacheRoot, 'remotion-whisper', 'whisper.cpp');
const TRANSCRIPTION_PROGRESS_START = 0.55;
const TRANSCRIPTION_PROGRESS_END = 0.9;

export const mapTranscriptionProgress = (progress: number): number => {
	const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
	return TRANSCRIPTION_PROGRESS_START + normalized * (TRANSCRIPTION_PROGRESS_END - TRANSCRIPTION_PROGRESS_START);
};

const createTranscriptionProgressReporter = (update: (patch: Partial<JobManifest>) => Promise<void>) => {
	let latestProgress = 0;
	let pendingWrite = Promise.resolve();

	return {
		report(progress: number) {
			const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
			if (normalized <= latestProgress) return;
			latestProgress = normalized;
			pendingWrite = pendingWrite.then(() =>
				update({ stage: 'transcribing', progress: mapTranscriptionProgress(normalized) })
			);
		},
		flush: () => pendingWrite,
	};
};

const run = (command: string, args: string[]) =>
	new Promise<void>((done, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
		let stderr = '';
		child.stderr.on('data', (chunk) => {
			stderr += String(chunk).slice(-8000);
		});
		child.once('error', reject);
		child.once('close', (code) =>
			code === 0 ? done() : reject(new Error(`${command} failed (${code}). ${stderr.trim()}`))
		);
	});

export const verifyVideo = async (path: string) =>
	run('ffprobe', [
		'-v',
		'error',
		'-select_streams',
		'v:0',
		'-show_entries',
		'stream=codec_name',
		'-of',
		'default=nw=1',
		path,
	]);

const executableCandidates = [
	'main.exe',
	'main',
	join('build', 'bin', 'main.exe'),
	join('build', 'bin', 'main'),
	join('build', 'bin', 'whisper-cli.exe'),
	join('build', 'bin', 'whisper-cli'),
];
const hasWhisper = () => executableCandidates.some((candidate) => existsSync(resolve(whisperPath, candidate)));
const modelCandidates = () => [
	resolve(whisperPath, 'models', `ggml-${model}.bin`),
	resolve(whisperPath, `ggml-${model}.bin`),
];

const atomicJson = async (target: string, value: unknown) => {
	const temporary = `${target}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	await rename(temporary, target);
};

const ensureWhisper = async (update: (patch: Partial<JobManifest>) => Promise<void>) => {
	await mkdir(cacheRoot, { recursive: true });
	if (!hasWhisper()) {
		await update({ stage: 'installing-whisper', progress: 0.35 });
		await rm(whisperPath, { recursive: true, force: true });
		await installWhisperCpp({ to: whisperPath, version: WHISPER_CPP_VERSION, printOutput: true });
	}
	if (!modelCandidates().some(existsSync)) {
		await update({ stage: 'downloading-model', progress: 0.45 });
		await downloadWhisperModel({ model, folder: whisperPath, printOutput: true });
	}
};

const buildTokens = (captions: Parameters<typeof createTikTokStyleCaptions>[0]['captions']) =>
	createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 2000 }).pages.map((page) => ({
		startMs: page.startMs,
		durationMs: page.durationMs,
		endMs: Math.round(page.startMs + page.durationMs),
		text: page.text,
		tokens: page.tokens.map((token) => ({ text: token.text, fromMs: token.fromMs, toMs: token.toMs })),
	}));

export const runCaptionPipeline = async (job: JobManifest, update: (patch: Partial<JobManifest>) => Promise<void>) => {
	if (!job.videoSlug || !job.action) throw new Error('Caption job is missing its video or action.');
	const paths = videoPaths(job.videoSlug);
	const force = job.force === true;
	if (!existsSync(paths.video)) throw new Error('Source video.mp4 is missing.');

	const wantsAudio = job.action === 'audio' || job.action === 'full';
	const wantsCaptions = job.action === 'captions' || job.action === 'full';
	const wantsTokens = job.action === 'tokens' || job.action === 'full';
	if (force && wantsAudio)
		await Promise.all([
			rm(paths.audio, { force: true }),
			rm(paths.captions, { force: true }),
			rm(paths.tokens, { force: true }),
		]);
	else if (force && wantsCaptions)
		await Promise.all([rm(paths.captions, { force: true }), rm(paths.tokens, { force: true })]);
	else if (force && wantsTokens) await rm(paths.tokens, { force: true });

	if (wantsAudio && !existsSync(paths.audio)) {
		await update({ stage: 'extracting-audio', progress: 0.1 });
		await run('ffmpeg', [
			'-y',
			'-i',
			paths.video,
			'-vn',
			'-ac',
			'1',
			'-ar',
			'16000',
			'-sample_fmt',
			's16',
			paths.audio,
		]);
	}
	if (wantsCaptions && !existsSync(paths.captions)) {
		if (!existsSync(paths.audio))
			throw new Error('audio.wav is required. Generate audio first or run the full pipeline.');
		await ensureWhisper(update);
		await update({ stage: 'transcribing', progress: TRANSCRIPTION_PROGRESS_START });
		const transcriptionProgress = createTranscriptionProgressReporter(update);
		const output = await transcribe({
			inputPath: paths.audio,
			whisperPath,
			whisperCppVersion: WHISPER_CPP_VERSION,
			model,
			tokenLevelTimestamps: true,
			splitOnWord: true,
			printOutput: true,
			onProgress: transcriptionProgress.report,
		});
		await transcriptionProgress.flush();
		await update({ stage: 'saving-captions', progress: 0.92 });
		const { captions } = toCaptions({ whisperCppOutput: output });
		if (!captions.length) throw new Error('Transcription completed without captions.');
		await atomicJson(paths.captions, captions);
	}
	if (wantsTokens && !existsSync(paths.tokens)) {
		if (!existsSync(paths.captions))
			throw new Error('captions.json is required. Generate captions first or run the full pipeline.');
		await update({ stage: 'building-tokens', progress: 0.96 });
		const raw = JSON.parse(await readFile(paths.captions, 'utf8'));
		const captions = Array.isArray(raw) ? raw : raw.captions;
		if (!Array.isArray(captions)) throw new Error('captions.json is invalid.');
		await atomicJson(paths.tokens, buildTokens(captions));
	}
};
