import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { request, slugify, uploadRequest, type UploadProgress, type VideoSummary } from '../api';
import { button, card, cardGrid, dangerButton, eyebrow, hero, heroTitle, input, mutedText, notice, pageShell } from '../ui';

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const badgeClass = (ready: boolean) =>
	`rounded-md px-2 py-1 text-[11px] ${ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-900 text-slate-500'}`;

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
		<main className={pageShell}>
			<section className={hero}>
				<div>
					<p className={eyebrow}>Video library</p>
					<h1 className={heroTitle}>Source media and captions.</h1>
					<p className={mutedText}>Upload once, generate captions, then attach the video to any project.</p>
				</div>
				<form className="grid w-full gap-2 lg:max-w-sm" onSubmit={(e) => void upload(e)}>
					<input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Video name (optional)" />
					<input
						accept="video/mp4,.mp4"
						className={input}
						onChange={(e) => {
							setFile(e.target.files?.[0] || null);
							setUploadProgress(null);
						}}
						type="file"
					/>
					<button className={button} disabled={busy}>
						{busy ? 'Uploading...' : 'Upload MP4'}
					</button>
					{uploadProgress && (
						<div
							aria-label={`Upload progress ${Math.round(uploadProgress.percent * 100)}%`}
							aria-valuemax={100}
							aria-valuemin={0}
							aria-valuenow={Math.round(uploadProgress.percent * 100)}
							className="relative my-3 h-3 rounded-full bg-white/10"
							role="progressbar"
						>
							<span
								className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300 transition-[width]"
								style={{ width: `${Math.round(uploadProgress.percent * 100)}%` }}
							/>
							<strong className="mt-2 block text-sm text-indigo-100/80">
								{Math.round(uploadProgress.percent * 100)}%
							</strong>
						</div>
					)}
				</form>
			</section>
			{message && <p className={notice}>{message}</p>}
			<section className={cardGrid}>
				{videos.map((video) => (
					<article className={card} key={video.slug}>
						<div className="relative grid aspect-[1080/1920] place-items-center overflow-hidden rounded-2xl border border-sky-200/15 bg-slate-950 p-3">
							<video
								className="block h-full w-full rounded-xl bg-black object-contain object-center"
								controls
								preload="metadata"
								src={video.previewUrl}
							/>
							<span className="absolute left-3 top-3 rounded-full border border-sky-200/20 bg-slate-950/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-indigo-100">
								1080 x 1920
							</span>
						</div>
						<div>
							<h2 className="my-3 text-2xl font-black text-white">{video.slug}</h2>
							<p className={mutedText}>{size(video.sizeBytes)}</p>
							<div className="flex gap-1.5">
								<span className={badgeClass(video.hasPreview)}>Proxy</span>
								<span className={badgeClass(video.hasAudio)}>WAV</span>
								<span className={badgeClass(video.hasCaptions)}>Captions</span>
								<span className={badgeClass(video.hasTokens)}>Tokens</span>
							</div>
						</div>
						<div className="mt-5 flex gap-2">
							<Link className={`${button} flex-1 text-center no-underline`} to={`/videos/${video.slug}`}>
								Open pipeline
							</Link>
							<button className={`${dangerButton} flex-1`} onClick={() => void remove(video.slug)}>
								Delete
							</button>
						</div>
					</article>
				))}
			</section>
			{!videos.length && <div className={notice}>Your video library is empty.</div>}
		</main>
	);
};
