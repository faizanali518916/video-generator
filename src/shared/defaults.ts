import { defaultTheme, type InfographicTemplate } from '../layoutCatalog';
import type { ProjectDocument } from './schemas';

export const createDefaultTemplate = (): InfographicTemplate => ({
	title: 'New project',
	intro: true,
	outro: true,
	videoBased: false,
	caption: false,
	theme: { ...defaultTheme },
	segments: [
		{
			videoShown: false,
			layout: 'process',
			title: 'Start here',
			durationSeconds: 6,
			items: ['First step', 'Second step', 'Third step'],
		},
	],
});

export const createDefaultProject = (name: string): ProjectDocument => ({
	schemaVersion: 1,
	name,
	videoSlug: null,
	template: createDefaultTemplate(),
});
