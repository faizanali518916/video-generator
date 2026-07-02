import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jsonOptions, request, slugify, type ProjectSummary } from '../api';

export const ProjectsPage = () => {
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	const [name, setName] = useState('');
	const [error, setError] = useState('');
	const navigate = useNavigate();
	const load = () =>
		request<ProjectSummary[]>('/api/projects')
			.then(setProjects)
			.catch((e: Error) => setError(e.message));
	useEffect(() => {
		void load();
	}, []);
	const create = async () => {
		try {
			const slug = slugify(name);
			if (!slug) throw new Error('Enter a project name.');
			const project = await request<ProjectSummary>('/api/projects', jsonOptions('POST', { slug, name }));
			navigate(`/projects/${project.slug}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};
	const remove = async (slug: string) => {
		if (!confirm(`Delete project '${slug}'? Renders and videos will remain.`)) return;
		await request(`/api/projects/${slug}`, { method: 'DELETE' });
		await load();
	};
	return (
		<main className="page-shell">
			<section className="page-hero">
				<div>
					<p className="eyebrow">Project library</p>
					<h1>Build videos from reusable templates.</h1>
					<p>Projects are small JSON documents. Your source videos stay independent and reusable.</p>
				</div>
				<div className="create-row">
					<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
					<button onClick={() => void create()}>New project</button>
				</div>
			</section>
			{error && <p className="notice error">{error}</p>}
			<section className="card-grid">
				{projects.map((project) => (
					<article className="library-card" key={project.slug}>
						<div>
							<span className="status-chip">{project.template.videoBased ? 'Video-based' : 'Infographic'}</span>
							<h2>{project.name}</h2>
							<p>{project.videoSlug ? `Video: ${project.videoSlug}` : 'No video selected'}</p>
							<small>Updated {new Date(project.updatedAt).toLocaleString()}</small>
						</div>
						<div className="card-actions">
							<Link to={`/projects/${project.slug}`}>Open editor</Link>
							<button className="danger" onClick={() => void remove(project.slug)}>
								Delete
							</button>
						</div>
					</article>
				))}
			</section>
			{!projects.length && !error && (
				<div className="empty-state">No projects yet. Give the first one a name above.</div>
			)}
		</main>
	);
};
