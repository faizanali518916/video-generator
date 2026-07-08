import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jsonOptions, request, slugify, type ProjectSummary } from '../api';
import { button, card, cardGrid, chip, dangerButton, errorNotice, eyebrow, hero, heroTitle, input, mutedText, notice, pageShell } from '../ui';

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
		<main className={pageShell}>
			<section className={hero}>
				<div>
					<p className={eyebrow}>Project library</p>
					<h1 className={heroTitle}>Build videos from reusable templates.</h1>
					<p className={mutedText}>Projects are small JSON documents. Your source videos stay independent and reusable.</p>
				</div>
				<div className="grid w-full gap-2 lg:max-w-sm">
					<input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
					<button className={button} onClick={() => void create()}>
						New project
					</button>
				</div>
			</section>
			{error && <p className={errorNotice}>{error}</p>}
			<section className={cardGrid}>
				{projects.map((project) => (
					<article className={card} key={project.slug}>
						<div>
							<span className={chip}>{project.template.videoBased ? 'Video-based' : 'Infographic'}</span>
							<h2 className="my-3 text-2xl font-black text-white">{project.name}</h2>
							<p className={mutedText}>{project.videoSlug ? `Video: ${project.videoSlug}` : 'No video selected'}</p>
							<small className={mutedText}>Updated {new Date(project.updatedAt).toLocaleString()}</small>
						</div>
						<div className="mt-5 flex gap-2">
							<Link className={`${button} flex-1 text-center no-underline`} to={`/projects/${project.slug}`}>
								Open editor
							</Link>
							<button className={`${dangerButton} flex-1`} onClick={() => void remove(project.slug)}>
								Delete
							</button>
						</div>
					</article>
				))}
			</section>
			{!projects.length && !error && (
				<div className={notice}>No projects yet. Give the first one a name above.</div>
			)}
		</main>
	);
};
