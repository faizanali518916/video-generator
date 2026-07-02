import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS = resolve(ROOT, 'projects');
export const VIDEOS = resolve(ROOT, 'videos');
export const RENDERS = resolve(ROOT, 'renders');
export const RUNTIME = resolve(ROOT, '.runtime');
export const UPLOADS = resolve(RUNTIME, 'uploads');
export const JOBS = resolve(RUNTIME, 'jobs');
export const JOB_STATES = ['queued', 'running', 'completed', 'failed'] as const;

export const assertInside = (target: string, root: string) => {
	const resolvedTarget = resolve(target);
	const resolvedRoot = resolve(root);
	if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
		throw new Error('Resolved path is outside the configured data directory.');
	}
	return resolvedTarget;
};
