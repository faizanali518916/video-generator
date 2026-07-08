import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request, type RenderSummary } from '../api';
import { button, card, cardGrid, chip, errorNotice, eyebrow, hero, heroTitle, mutedText, notice, pageShell } from '../ui';

const statusLabel = (job: RenderSummary) => {
	if (job.status === 'failed') return 'Failed';
	if (job.deliveryStatus === 'emailed') return 'Delivered';
	if (job.deliveryStatus === 'uploaded') return 'Uploaded';
	if (job.deliveryStatus === 'local') return 'Local only';
	if (job.deliveryStatus === 'partial') return 'Partial';
	return job.status === 'completed' ? 'Rendered' : job.status;
};

const statusColor = (job: RenderSummary) => {
	if (job.status === 'failed') return 'border-rose-300/35 bg-rose-500/15 text-rose-200';
	if (['emailed', 'uploaded'].includes(job.deliveryStatus || '')) return 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200';
	if (job.deliveryStatus === 'partial') return 'border-amber-300/35 bg-amber-500/15 text-amber-100';
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
		<main className={pageShell}>
			<section className={hero}>
				<div>
					<p className={eyebrow}>Render history</p>
					<h1 className={heroTitle}>Completed renders, delivery status, and local files.</h1>
					<p className={mutedText}>Everything here is read from the filesystem, so the list reflects what the app has actually saved.</p>
				</div>
				<div className="grid w-full gap-2 lg:max-w-xs">
					<button className={button} onClick={() => void load()}>
						Refresh
					</button>
				</div>
			</section>
			{error && <p className={errorNotice}>{error}</p>}
			<section className={cardGrid}>
				{renders.map((job) => {
					const progress = Math.min(100, Math.max(0, job.progress * 100));

					return (
						<article className={`${card} gap-4`} key={`${job.id}-${job.status}`}>
							<div className="flex flex-1 flex-col">
								<div className="flex flex-wrap gap-2">
									<span className={`${chip} ${statusColor(job)}`}>{statusLabel(job)}</span>
									<span className={`${chip} ${job.driveConfigured ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200' : ''}`}>
										{job.driveConfigured ? 'Drive' : 'Local'}
									</span>
									<span className={`${chip} ${job.emailSent ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200' : ''}`}>
										{job.emailSent ? 'Email sent' : 'Email pending'}
									</span>
								</div>
								<h2 className="my-3 text-xl font-black text-white">{job.projectSlug || 'Render job'}</h2>
								<p className={`${mutedText} m-0 break-words`}>
									{job.recipientEmail ? `Notification email: ${job.recipientEmail}` : 'No email provided'}
								</p>
								<small className={mutedText}>Updated {new Date(job.updatedAt).toLocaleString()}</small>
								<div className="mt-4 rounded-xl border border-sky-200/10 bg-white/[0.03] p-3">
									<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2">
										<span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Stage</span>
										<strong className="truncate text-sm text-indigo-50">{formatStage(job.stage)}</strong>
										{job.status !== 'failed' && <em className="text-xs font-extrabold not-italic text-indigo-200">{Math.round(progress)}%</em>}
									</div>
									{job.status !== 'failed' && (
										<div
											aria-label={`${formatStage(job.stage)}: ${Math.round(progress)}%`}
											aria-valuemax={100}
											aria-valuemin={0}
											aria-valuenow={Math.round(progress)}
											className="mt-2 h-2 overflow-hidden rounded-full bg-slate-400/15"
											role="progressbar"
										>
											<span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-300" style={{ width: `${progress}%` }} />
										</div>
									)}
								</div>
								{job.deliveryError && <p className="mt-3 max-h-24 overflow-auto rounded-xl border border-dashed border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100">{job.deliveryError}</p>}
								{job.error && <p className="mt-3 max-h-24 overflow-auto rounded-xl border border-dashed border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100">{job.error}</p>}
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								{job.projectSlug && <Link className={`${button} flex-1 text-center no-underline`} to={`/projects/${job.projectSlug}`}>Open project</Link>}
								{job.downloadUrl && <a className={`${button} flex-1 text-center no-underline`} href={job.downloadUrl}>Download MP4</a>}
								{job.driveConfigured && job.driveLink && <a className={`${button} flex-1 text-center no-underline`} href={job.driveLink}>Drive link</a>}
							</div>
						</article>
					);
				})}
			</section>
			{!renders.length && !error && <div className={notice}>No renders yet.</div>}
		</main>
	);
};
