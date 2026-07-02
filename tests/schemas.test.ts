import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../src/shared/defaults';
import {
	projectDocumentSchema,
	slugSchema,
	templateSchema,
	videoFolderForSlug,
	videoSlugFromFolder,
} from '../src/shared/schemas';

describe('shared schemas', () => {
	it('accepts a default project', () => {
		expect(projectDocumentSchema.parse(createDefaultProject('Test'))).toBeTruthy();
	});
	it.each(['../escape', 'Uppercase', 'two--hyphens', 'white space', ''])('rejects unsafe slug %s', (slug) => {
		expect(() => slugSchema.parse(slug)).toThrow();
	});
	it.each(['brand-video', 'process-optimization', 'video2'])('accepts slug %s', (slug) => {
		expect(slugSchema.parse(slug)).toBe(slug);
	});
	it('stores a safe video folder path in the template', () => {
		const template = createDefaultProject('Test').template;
		const videoFolder = videoFolderForSlug('brand-video');
		expect(templateSchema.parse({ ...template, videoFolder }).videoFolder).toBe('../../videos/brand-video');
		expect(videoSlugFromFolder(videoFolder)).toBe('brand-video');
		expect(() => templateSchema.parse({ ...template, videoFolder: '../../outside' })).toThrow();
	});
});
