import type { ProjectDocument, JobManifest } from './shared/schemas';
import type { TranscriptPage } from './video/types';

export type VideoSummary = {
	slug: string;
	sizeBytes: number;
	updatedAt: string;
	hasAudio: boolean;
	hasCaptions: boolean;
	hasTokens: boolean;
	previewUrl: string;
};
export type VideoDetail = VideoSummary & { transcriptPages: TranscriptPage[]; activeJob: JobManifest | null };
export type ProjectSummary = ProjectDocument & { slug: string; updatedAt: string };

export const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
	const response = await fetch(url, options);
	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
		throw new Error(payload.error?.message || `Request failed (${response.status}).`);
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
};

export const jsonOptions = (method: string, body?: unknown): RequestInit => ({
	method,
	headers: { 'Content-Type': 'application/json' },
	...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const slugify = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.replace(/-+/g, '-');
