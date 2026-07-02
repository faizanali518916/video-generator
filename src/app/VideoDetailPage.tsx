import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jsonOptions, request, type VideoDetail } from '../api';
import type { JobManifest, PipelineRequest } from '../shared/schemas';

const stageDetails: Record<string, { label: string; description: string }> = {
	queued: { label: 'Queued', description: 'Waiting for the current task to begin.' },
	starting: { label: 'Starting', description: 'Preparing the caption pipeline.' },
	'extracting-audio': { label: 'Extracting audio', description: 'Creating a clean 16 kHz audio track.' },
	'installing-whisper': { label: 'Installing Whisper', description: 'Preparing the transcription engine.' },
	'downloading-model': { label: 'Downloading model', description: 'Downloading the selected Whisper model.' },
	transcribing: { label: 'Transcribing', description: 'Whisper is converting speech into timed text.' },
	'saving-captions': { label: 'Saving captions', description: 'Writing the timestamped caption file.' },
	'building-tokens': { label: 'Building tokens', description: 'Formatting captions for the video overlay.' },
	completed: { label: 'Completed', description: 'The video and caption files are ready.' },
	failed: { label: 'Pipeline failed', description: 'The pipeline could not finish.' },
	interrupted: { label: 'Pipeline interrupted', description: 'The application stopped during processing.' },
};

export const VideoDetailPage = () => {
	const { slug = '' } = useParams();
	const [video, setVideo] = useState<VideoDetail | null>(null);
	const [job, setJob] = useState<JobManifest | null>(null);
	const [force, setForce] = useState(false);
	const [error, setError] = useState('');
	const jobRunning = Boolean(job && !['completed', 'failed'].includes(job.status));
	const progressPercent = job ? Math.round(Math.min(1, Math.max(0, job.progress)) * 100) : 0;
	const stage = job ? (stageDetails[job.stage] ?? { label: job.stage.replaceAll('-', ' '), description: '' }) : null;
	const load = useCallback(
		() =>
			request<VideoDetail>(`/api/videos/${slug}`).then((value) => {
				setVideo(value);
				if (value.activeJob) setJob(value.activeJob);
			}),
		[slug]
	);
	useEffect(() => {
		void load().catch((e: Error) => setError(e.message));
	}, [load]);
	useEffect(() => {
		if (!job || ['completed', 'failed'].includes(job.status)) return;
		const timer = setInterval(
			() =>
				void request<JobManifest>(`/api/jobs/${job.id}`).then((next) => {
					setJob(next);
					if (['completed', 'failed'].includes(next.status)) void load();
				}),
			300
		);
		return () => clearInterval(timer);
	}, [job, load]);
	const run = async (action: PipelineRequest['action']) => {
		try {
			setError('');
			setJob(await request(`/api/videos/${slug}/pipeline`, jsonOptions('POST', { action, force })));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};
	if (!video)
		return (
			<main className="page-shell">
				<p>{error || 'Loading video…'}</p>
			</main>
		);
	return (
		<main className="page-shell">
			<Link className="back-link" to="/videos">
				← Video library
			</Link>
			<section className="detail-grid">
				<div className="video-panel">
					<video controls src={video.previewUrl} />
					<h1>{slug}</h1>
				</div>
				<section className="pipeline-panel">
					<p className="eyebrow">Caption pipeline</p>
					<h2>Generate each artifact in order.</h2>
					<div className="pipeline-list">
						<div className={video.hasAudio ? 'done' : ''}>
							<strong>1. audio.wav</strong>
							<button
								disabled={Boolean(job && !['completed', 'failed'].includes(job.status))}
								onClick={() => void run('audio')}
							>
								Generate audio
							</button>
						</div>
						<div className={video.hasCaptions ? 'done' : ''}>
							<strong>2. captions.json</strong>
							<button
								disabled={!video.hasAudio || Boolean(job && !['completed', 'failed'].includes(job.status))}
								onClick={() => void run('captions')}
							>
								Generate captions
							</button>
						</div>
						<div className={video.hasTokens ? 'done' : ''}>
							<strong>3. tokens.json</strong>
							<button
								disabled={!video.hasCaptions || Boolean(job && !['completed', 'failed'].includes(job.status))}
								onClick={() => void run('tokens')}
							>
								Build tokens
							</button>
						</div>
					</div>
					<label className="force-toggle">
						<input checked={force} onChange={(e) => setForce(e.target.checked)} type="checkbox" /> Regenerate and
						invalidate downstream files
					</label>
					<button className="primary-wide" disabled={jobRunning} onClick={() => void run('full')}>
						{jobRunning ? 'Pipeline runningâ€¦' : 'Run full pipeline'}
					</button>
					{job && stage && (
						<div className={`pipeline-progress-card ${job.status}`} aria-live="polite">
							<div className="pipeline-progress-header">
								<div>
									<span className="pipeline-progress-kicker">Caption pipeline</span>
									<strong>{stage.label}</strong>
								</div>
								<span className="pipeline-progress-percent">{progressPercent}%</span>
							</div>
							<div
								aria-label={`${stage.label}: ${progressPercent}%`}
								aria-valuemax={100}
								aria-valuemin={0}
								aria-valuenow={progressPercent}
								className="pipeline-progress-track"
								role="progressbar"
							>
								<span className="pipeline-progress-fill" style={{ width: `${progressPercent}%` }} />
							</div>
							{stage.description && <p className="pipeline-progress-description">{stage.description}</p>}
							{job.error && <p className="pipeline-progress-error">{job.error}</p>}
						</div>
					)}
					{error && <p className="notice error">{error}</p>}
				</section>
			</section>
		</main>
	);
};
