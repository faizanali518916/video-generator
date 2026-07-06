import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request, type RenderSummary } from '../api';

const statusLabel = (job: RenderSummary) => {
	if (job.status === 'failed') return 'Failed';
	if (job.deliveryStatus === 'emailed') return 'Delivered';
	if (job.deliveryStatus === 'uploaded') return 'Uploaded';
	if (job.deliveryStatus === 'local') return 'Local only';
	if (job.deliveryStatus === 'partial') return 'Partial';
	return job.status === 'completed' ? 'Rendered' : job.status;
};

const statusClass = (job: RenderSummary) => {
	if (job.status === 'failed') return 'danger';
	if (job.deliveryStatus === 'emailed') return 'ready';
	if (job.deliveryStatus === 'partial') return 'warning';
	if (job.deliveryStatus === 'uploaded') return 'ready';
	return '';
};

const formatStage = (stage: string) =>
	stage
		.split('-')
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');

export const RendersPage = () => {
	const [renders, setRenders] = useState<RenderSummary[]>([]);
	const [error, setError] = useState('');

	const load = () =>
		request<RenderSummary[]>('/api/renders')
			.then(setRenders)
			.catch((e: Error) => setError(e.message));

	useEffect(() => {
		void load();
	}, []);

	useEffect(() => {
		if (!renders.some((job) => ['queued', 'running'].includes(job.status))) return;
		const timer = setInterval(() => void load(), 2000);
		return () => clearInterval(timer);
	}, [renders]);

	return (
		<main className="page-shell">
			<section className="page-hero">
				<div>
					<p className="eyebrow">Render history</p>
					<h1>Completed renders, delivery status, and local files.</h1>
					<p>Everything here is read from the filesystem, so the list reflects what the app has actually saved.</p>
				</div>
				<div className="create-row">
					<button onClick={() => void load()}>Refresh</button>
				</div>
			</section>
			{error && <p className="notice error">{error}</p>}
			<section className="card-grid render-history-grid">
				{renders.map((job) => (
					<article className={`library-card render-history-card status-${job.status}`} key={`${job.id}-${job.status}`}>
						<div className="render-card-content">
							<div className="render-card-badges">
								<span className={`status-chip ${statusClass(job)}`}>{statusLabel(job)}</span>
								<span className={`status-chip render-meta-chip ${job.driveConfigured ? 'ready' : ''}`}>
									{job.driveConfigured ? 'Drive' : 'Local'}
								</span>
								<span className={`status-chip render-meta-chip ${job.emailSent ? 'ready' : ''}`}>
									{job.emailSent ? 'Email sent' : 'Email pending'}
								</span>
							</div>
							<h2>{job.projectSlug || 'Render job'}</h2>
							<p>{job.recipientEmail ? `Notification email: ${job.recipientEmail}` : 'No email provided'}</p>
							<small>Updated {new Date(job.updatedAt).toLocaleString()}</small>
							<div className={`render-card-progress ${job.status === 'failed' ? 'stage-only' : ''}`}>
								<div className="render-card-progress-label">
									<span>Stage</span>
									<strong>{formatStage(job.stage)}</strong>
									{job.status !== 'failed' && <em>{Math.round(job.progress * 100)}%</em>}
								</div>
								{job.status !== 'failed' && (
									<div
										aria-label={`${formatStage(job.stage)}: ${Math.round(job.progress * 100)}%`}
										aria-valuemax={100}
										aria-valuemin={0}
										aria-valuenow={Math.round(job.progress * 100)}
										className="render-card-progress-track"
										role="progressbar"
									>
										<span style={{ width: `${Math.min(100, Math.max(0, job.progress * 100))}%` }} />
									</div>
								)}
							</div>
							{job.deliveryError && <p className="render-card-error">{job.deliveryError}</p>}
							{job.error && <p className="render-card-error">{job.error}</p>}
						</div>
						<div className="card-actions">
							{job.projectSlug && <Link to={`/projects/${job.projectSlug}`}>Open project</Link>}
							{job.downloadUrl && <a href={job.downloadUrl}>Download MP4</a>}
							{job.driveConfigured && job.driveLink && <a href={job.driveLink}>Drive link</a>}
						</div>
					</article>
				))}
			</section>
			{!renders.length && !error && <div className="empty-state">No renders yet.</div>}
		</main>
	);
};
