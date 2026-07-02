import { rm } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../server/app';
import { PROJECTS } from '../server/paths';

const slug = `api-project-${Date.now()}`;
let app: Awaited<ReturnType<typeof createApplication>>['app'];

beforeAll(async () => {
	app = (await createApplication({ autoStartJobs: false })).app;
});
afterAll(async () => {
	await rm(`${PROJECTS}/${slug}`, { recursive: true, force: true });
});

describe('project API', () => {
	it('reports health', async () => {
		const response = await request(app).get('/api/health');
		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
	});
	it('creates and reads a filesystem project', async () => {
		const created = await request(app).post('/api/projects').send({ slug, name: 'API project' });
		expect(created.status).toBe(201);
		expect(created.body.slug).toBe(slug);
		const loaded = await request(app).get(`/api/projects/${slug}`);
		expect(loaded.status).toBe(200);
		expect(loaded.body.name).toBe('API project');
	});
	it('rejects path traversal', async () => {
		const response = await request(app).get('/api/projects/..%2Fescape');
		expect(response.status).toBe(400);
	});
	it('serves the React application for client-side routes', async () => {
		const response = await request(app).get('/projects');
		expect(response.status).toBe(200);
		expect(response.text).toContain('Video Generator');
	});
});
