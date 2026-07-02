import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { JobManifest } from '../src/shared/schemas';
import { atomicWriteJson, ensureDataDirectories, exists, readJson } from './fs-store';
import { JOBS, JOB_STATES } from './paths';

type Processor = (
	job: JobManifest,
	update: (patch: Partial<JobManifest>) => Promise<void>
) => Promise<Partial<JobManifest> | void>;

export class JobQueue {
	private processing = false;
	private scheduled = false;
	constructor(
		private readonly processor: Processor,
		private readonly autoStart = true
	) {}

	private stateDir(state: JobManifest['status']) {
		return resolve(JOBS, state);
	}
	private file(state: JobManifest['status'], id: string) {
		return resolve(this.stateDir(state), `${id}.json`);
	}

	async initialize() {
		await ensureDataDirectories();
		await Promise.all(JOB_STATES.map((state) => mkdir(this.stateDir(state), { recursive: true })));
		const interrupted = await readdir(this.stateDir('running'));
		for (const file of interrupted.filter((name) => name.endsWith('.json'))) {
			const current = await readJson<JobManifest>(resolve(this.stateDir('running'), file));
			const failed = {
				...current,
				status: 'failed' as const,
				stage: 'interrupted',
				error: 'Application stopped during processing.',
				updatedAt: new Date().toISOString(),
			};
			await atomicWriteJson(resolve(this.stateDir('running'), file), failed);
			await rename(resolve(this.stateDir('running'), file), resolve(this.stateDir('failed'), file));
		}
		if (this.autoStart) this.schedule();
	}

	async listActive() {
		const states = ['queued', 'running'] as const;
		const jobs: JobManifest[] = [];
		for (const state of states) {
			for (const file of (await readdir(this.stateDir(state))).filter((name) => name.endsWith('.json')))
				jobs.push(await readJson(resolve(this.stateDir(state), file)));
		}
		return jobs;
	}

	async enqueue(input: Omit<JobManifest, 'id' | 'status' | 'stage' | 'progress' | 'createdAt' | 'updatedAt'>) {
		const active = await this.listActive();
		const duplicate = active.find(
			(job) =>
				job.kind === input.kind &&
				(input.videoSlug ? job.videoSlug === input.videoSlug : job.projectSlug === input.projectSlug)
		);
		if (duplicate)
			throw Object.assign(new Error('A matching job is already active.'), {
				code: 'JOB_ACTIVE',
				status: 409,
				details: { jobId: duplicate.id },
			});
		const now = new Date().toISOString();
		const job: JobManifest = {
			...input,
			id: randomUUID(),
			status: 'queued',
			stage: 'queued',
			progress: 0,
			createdAt: now,
			updatedAt: now,
		};
		await atomicWriteJson(this.file('queued', job.id), job);
		if (this.autoStart) this.schedule();
		return job;
	}

	async get(id: string) {
		if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
		for (const state of JOB_STATES)
			if (await exists(this.file(state, id))) return readJson<JobManifest>(this.file(state, id));
		return null;
	}

	private schedule() {
		if (this.scheduled || this.processing) return;
		this.scheduled = true;
		setTimeout(() => {
			this.scheduled = false;
			void this.drain();
		}, 0);
	}

	private async drain() {
		if (this.processing) return;
		this.processing = true;
		try {
			while (true) {
				const files = (await readdir(this.stateDir('queued'))).filter((file) => file.endsWith('.json')).sort();
				if (!files.length) break;
				const queuedFile = resolve(this.stateDir('queued'), files[0]);
				let job = await readJson<JobManifest>(queuedFile);
				job = { ...job, status: 'running', stage: 'starting', updatedAt: new Date().toISOString() };
				await atomicWriteJson(queuedFile, job);
				const runningFile = this.file('running', job.id);
				await rename(queuedFile, runningFile);
				const update = async (patch: Partial<JobManifest>) => {
					job = { ...job, ...patch, id: job.id, updatedAt: new Date().toISOString() };
					await atomicWriteJson(runningFile, job);
				};
				try {
					const result = await this.processor(job, update);
					await update({ ...result, status: 'completed', stage: 'completed', progress: 1, error: undefined });
					await rename(runningFile, this.file('completed', job.id));
				} catch (error) {
					await update({
						status: 'failed',
						stage: 'failed',
						error: error instanceof Error ? error.message : String(error),
					});
					await rename(runningFile, this.file('failed', job.id));
				}
			}
		} finally {
			this.processing = false;
		}
	}
}
