import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { request, slugify, uploadRequest, type UploadProgress, type VideoSummary } from '../api';

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const VideosPage = () => {
	const [videos, setVideos] = useState<VideoSummary[]>([]);
	const [name, setName] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [message, setMessage] = useState('');

	const load = () =>
		request<VideoSummary[]>('/api/videos')
			.then(setVideos)
			.catch((e: Error) => setMessage(e.message));

	useEffect(() => {
		void load();
	}, []);

	const upload = async (event: FormEvent) => {
		event.preventDefault();
		try {
			if (!file) throw new Error('Choose an MP4 file.');
			const slug = slugify(name || file.name.replace(/\.mp4$/i, ''));
			if (!slug) throw new Error('Enter a valid video name.');
			setBusy(true);
			setUploadProgress({ loaded: 0, total: 0, percent: 0 });
			const body = new FormData();
			body.set('slug', slug);
			body.set('video', file);
			await uploadRequest('/api/videos', {
				method: 'POST',
				body,
				onProgress: setUploadProgress,
			});
			setUploadProgress({ loaded: 1, total: 1, percent: 1 });
			setName('');
			setFile(null);
			setMessage('Upload complete.');
			await load();
		} catch (e) {
			setMessage(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
			setUploadProgress(null);
		}
	};

	const remove = async (slug: string) => {
		if (!confirm(`Delete video '${slug}' and all caption files?`)) return;
		try {
			await request(`/api/videos/${slug}`, { method: 'DELETE' });
			await load();
		} catch (e) {
			setMessage(e instanceof Error ? e.message : String(e));
		}
	};

	return (
		<main className="page-shell">
			<section className="page-hero">
				<div>
					<p className="eyebrow">Video library</p>
					<h1>Source media and captions.</h1>
					<p>Upload once, generate captions, then attach the video to any project.</p>
				</div>
				<form className="upload-form" onSubmit={(e) => void upload(e)}>
					<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Video name (optional)" />
					<input
						accept="video/mp4,.mp4"
						onChange={(e) => {
							setFile(e.target.files?.[0] || null);
							setUploadProgress(null);
						}}
						type="file"
					/>
					<button disabled={busy}>{busy ? 'Uploading...' : 'Upload MP4'}</button>
					{uploadProgress && (
						<div
							className="upload-progress"
							aria-label={`Upload progress ${Math.round(uploadProgress.percent * 100)}%`}
							aria-valuemax={100}
							aria-valuemin={0}
							aria-valuenow={Math.round(uploadProgress.percent * 100)}
							role="progressbar"
						>
							<span style={{ width: `${Math.round(uploadProgress.percent * 100)}%` }} />
							<strong>{Math.round(uploadProgress.percent * 100)}%</strong>
						</div>
					)}
				</form>
			</section>
			{message && <p className="notice">{message}</p>}
			<section className="card-grid">
				{videos.map((video) => (
					<article className="library-card media" key={video.slug}>
						<video controls preload="metadata" src={video.previewUrl} />
						<div>
							<h2>{video.slug}</h2>
							<p>{size(video.sizeBytes)}</p>
							<div className="pipeline-badges">
								<span className={video.hasAudio ? 'ready' : ''}>WAV</span>
								<span className={video.hasCaptions ? 'ready' : ''}>Captions</span>
								<span className={video.hasTokens ? 'ready' : ''}>Tokens</span>
							</div>
						</div>
						<div className="card-actions">
							<Link to={`/videos/${video.slug}`}>Open pipeline</Link>
							<button className="danger" onClick={() => void remove(video.slug)}>
								Delete
							</button>
						</div>
					</article>
				))}
			</section>
			{!videos.length && <div className="empty-state">Your video library is empty.</div>}
		</main>
	);
};
