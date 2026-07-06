import { Player } from '@remotion/player';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { JsonPanel } from '../builder/JsonPanel';
import { SegmentEditor } from '../builder/SegmentEditor';
import { ThemeEditor } from '../builder/ThemeEditor';
import { newSegment, toFormSegment, toTemplate } from '../builder/templateMapper';
import type { FormSegment } from '../builder/types';
import { jsonOptions, request, slugify, type VideoDetail, type VideoSummary } from '../api';
import {
	FPS,
	LAYOUT_SPECS,
	VIDEO_HEIGHT,
	VIDEO_WIDTH,
	defaultTheme,
	getTemplateDurationInFrames,
	type InfographicTemplate,
	type LayoutKind,
	type Theme,
} from '../layoutCatalog';
import {
	templateSchema,
	videoFolderForSlug,
	videoSlugFromFolder,
	type JobManifest,
	type ProjectDocument,
} from '../shared/schemas';
import { InfographicVideo } from '../video/InfographicVideo';
import type { TranscriptPage } from '../video/types';

type ProjectPayload = ProjectDocument & { slug: string };
type RenderJob = JobManifest & { downloadUrl?: string };

const formSegments = (template: InfographicTemplate): FormSegment[] =>
	template.segments.map((segment) => ({
		...toFormSegment(segment),
		videoShown: template.videoBased === true && segment.videoShown === true,
	}));

export const ProjectEditorPage = () => {
	const { slug = '' } = useParams();
	const navigate = useNavigate();
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [name, setName] = useState('');
	const [slugDraft, setSlugDraft] = useState(slug);
	const [videoSlug, setVideoSlug] = useState<string | null>(null);
	const [title, setTitle] = useState('');
	const [hookText, setHookText] = useState('');
	const [intro, setIntro] = useState(true);
	const [outro, setOutro] = useState(true);
	const [videoBased, setVideoBased] = useState(false);
	const [caption, setCaption] = useState(false);
	const [theme, setTheme] = useState<Theme>({ ...defaultTheme });
	const [segments, setSegments] = useState<FormSegment[]>([]);
	const [videos, setVideos] = useState<VideoSummary[]>([]);
	const [tokens, setTokens] = useState<TranscriptPage[]>([]);
	const [tokensLoaded, setTokensLoaded] = useState(false);
	const [tokensError, setTokensError] = useState('');
	const [jsonDraft, setJsonDraft] = useState('');
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
	const [renderStatus, setRenderStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
	const [renderError, setRenderError] = useState('');
	const [notificationEmail, setNotificationEmail] = useState('');

	const template = useMemo(
		() =>
			toTemplate(
				title,
				hookText,
				intro,
				outro,
				caption,
				theme,
				videoBased,
				segments,
				videoSlug ? videoFolderForSlug(videoSlug) : undefined
			),
		[title, hookText, intro, outro, caption, theme, videoBased, segments, videoSlug]
	);
	const durationInFrames = useMemo(() => getTemplateDurationInFrames(template, FPS), [template]);
	const applyTemplate = useCallback((next: InfographicTemplate, fallbackVideoSlug: string | null = null) => {
		setTitle(next.title);
		setHookText(next.hookText || '');
		setIntro(next.intro === true);
		setOutro(next.outro === true);
		setVideoBased(next.videoBased === true);
		setCaption(next.videoBased === true && next.caption === true);
		setVideoSlug(videoSlugFromFolder(next.videoFolder) ?? fallbackVideoSlug);
		setTheme({ ...defaultTheme, ...next.theme });
		setSegments(formSegments(next));
	}, []);
	useEffect(() => {
		void Promise.all([request<ProjectPayload>(`/api/projects/${slug}`), request<VideoSummary[]>('/api/videos')])
			.then(([project, list]) => {
				setName(project.name);
				setSlugDraft(project.slug);
				applyTemplate(project.template, project.videoSlug);
				setVideos(list);
				setLoaded(true);
			})
			.catch((e: Error) => setError(e.message));
	}, [slug, applyTemplate]);
	useEffect(() => {
		if (!loaded) return;
		setJsonDraft(JSON.stringify(template, null, 2));
		setJsonError(null);
	}, [template, loaded]);
	useEffect(() => {
		if (!videoSlug) {
			setTokens([]);
			setTokensLoaded(false);
			setTokensError('');
			return;
		}
		setTokensLoaded(false);
		setTokensError('');
		console.info('[tokens] loading transcript pages', { slug: videoSlug });
		void request<VideoDetail>(`/api/videos/${videoSlug}`)
			.then((video) => {
				const nextTokens = video.transcriptPages ?? [];
				console.info('[tokens] loaded transcript pages', {
					slug: videoSlug,
					pageCount: nextTokens.length,
				});
				setTokens(nextTokens);
				setTokensLoaded(true);
			})
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				console.error('[tokens] failed to load transcript pages', { error, slug: videoSlug });
				setTokens([]);
				setTokensLoaded(true);
				setTokensError(message);
			});
	}, [videoSlug]);
	useEffect(() => {
		if (!renderJob) return;
		if (renderJob.status === 'failed') {
			const nextError = renderJob.error || renderJob.deliveryError || 'Render failed.';
			console.error('[render] job failed', renderJob);
			setRenderStatus('error');
			setRenderError(`${nextError} The page shouldn't reload.`);
			return;
		}
		if (renderJob.status === 'completed') {
			if (renderJob.error || renderJob.deliveryError) {
				console.error('[render] job completed with errors', renderJob);
				setRenderStatus('error');
				setRenderError(`${renderJob.error || renderJob.deliveryError || 'Render failed.'} The page shouldn't reload.`);
			}
			return;
		}
		console.info('[render] polling job', { id: renderJob.id, status: renderJob.status, stage: renderJob.stage });
		const timer = setInterval(() => void request<RenderJob>(`/api/jobs/${renderJob.id}`).then(setRenderJob), 1000);
		return () => clearInterval(timer);
	}, [renderJob]);
	const previewVideoSrc = videoSlug ? `/api/videos/${encodeURIComponent(videoSlug)}/file` : undefined;
	const captionsMissing = videoBased && caption && videoSlug && tokensLoaded && tokens.length === 0;
	const captionsLoadIssue =
		videoBased && caption && tokensError ? `Could not load captions for ${videoSlug}: ${tokensError}` : '';
	const cannotRender = (videoBased && !videoSlug) || Boolean(jsonError);
	const sourceVideoDisabled = !videoBased;
	const noticeMessage =
		error ||
		renderError ||
		captionsLoadIssue ||
		(captionsMissing ? 'Captions are enabled, but this video has no tokens.json yet.' : message);
	const renderNotice =
		renderStatus === 'submitting' ? 'Render request sent. Waiting for the job to be created...' : null;
	useEffect(() => {
		const visibleMessages = [renderNotice, noticeMessage].filter(Boolean);

		if (!visibleMessages.length) {
			return;
		}

		console.info('[ui] visible message', {
			messages: visibleMessages,
			renderJob: renderJob
				? {
						deliveryStatus: renderJob.deliveryStatus ?? null,
						deliveryError: renderJob.deliveryError ?? null,
						error: renderJob.error ?? null,
						id: renderJob.id,
						stage: renderJob.stage,
						status: renderJob.status,
					}
				: null,
		});
	}, [noticeMessage, renderJob, renderNotice]);
	const save = async () => {
		const nextSlug = slugify(slugDraft);
		if (!nextSlug) throw new Error('Project slug is invalid.');
		const document: ProjectDocument = { schemaVersion: 1, name: name.trim(), videoSlug, template };
		await request(`/api/projects/${slug}`, jsonOptions('PUT', { slug: nextSlug, document }));
		setMessage('Saved to template.json.');
		if (nextSlug !== slug) navigate(`/projects/${nextSlug}`, { replace: true });
		return nextSlug;
	};
	const saveClick = async () => {
		try {
			setError('');
			await save();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};
	const render = async () => {
		try {
			console.info('[render] button clicked', {
				email: notificationEmail.trim() || null,
				projectSlug: slug,
				sourceVideo: videoSlug,
			});
			setError('');
			setRenderError('');
			setRenderStatus('submitting');
			const savedSlug = await save();
			const job = await request<RenderJob>(
				`/api/projects/${savedSlug}/render`,
				jsonOptions('POST', { email: notificationEmail.trim() || undefined })
			);
			console.info('[render] job queued', job);
			setRenderJob(job);
			setRenderStatus('idle');
			if (job.error || job.deliveryError) {
				console.error('[render] queue response included an error', job);
				setRenderStatus('error');
				setRenderError(`${job.error || job.deliveryError || 'Render failed.'} The page shouldn't reload.`);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error('[render] request failed', e);
			setRenderStatus('error');
			setRenderError(`${message} The page shouldn't reload.`);
		}
	};
	const updateSegment = (index: number, key: keyof FormSegment, value: FormSegment[keyof FormSegment]) =>
		setSegments((current) =>
			current.map((segment, i) => {
				if (i !== index) return segment;
				if (key === 'layout') {
					const layout = String(value) as LayoutKind;
					return { ...segment, layout, durationSeconds: String(LAYOUT_SPECS[layout].durationSeconds) };
				}
				return { ...segment, [key]: value };
			})
		);
	const move = (index: number, direction: -1 | 1) =>
		setSegments((current) => {
			const target = index + direction;
			if (target < 0 || target >= current.length) return current;
			const next = [...current];
			const [item] = next.splice(index, 1);
			next.splice(target, 0, item);
			return next;
		});
	const changeJson = (value: string) => {
		setJsonDraft(value);
		setCopied(false);
		try {
			const parsed = templateSchema.parse(JSON.parse(value)) as InfographicTemplate;
			applyTemplate(parsed);
			setJsonError(null);
		} catch (e) {
			setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
		}
	};

	if (!loaded)
		return (
			<main className="page-shell">
				<p>{error || 'Loading project…'}</p>
			</main>
		);
	return (
		<main className="editor-shell">
			<div className="editor-topbar">
				<label className="builder-field">
					<span>Project name</span>
					<input value={name} onChange={(e) => setName(e.target.value)} />
				</label>
				<label className="builder-field">
					<span>Project slug</span>
					<input value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} />
				</label>
				<label className="builder-field">
					<span>Notification email</span>
					<input
						placeholder="Optional"
						value={notificationEmail}
						onChange={(e) => setNotificationEmail(e.target.value)}
					/>
				</label>
				<button className="secondary editor-topbar-action" type="button" onClick={() => void saveClick()}>
					Save
				</button>
				<button
					className="editor-topbar-action"
					disabled={cannotRender}
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void render();
					}}
				>
					{renderStatus === 'submitting' ? 'Rendering...' : 'Render MP4'}
				</button>
			</div>
			{renderNotice ? <div className="notice render-notice">{renderNotice}</div> : null}
			{noticeMessage && (
				<div className={`notice ${error || renderError ? 'error render-error' : ''}`}>{noticeMessage}</div>
			)}
			{renderJob && (
				<div className={`render-banner ${renderJob.status}`}>
					<strong>{renderJob.stage.replaceAll('-', ' ')}</strong>
					<progress max="1" value={renderJob.progress} />
					<span>{Math.round(renderJob.progress * 100)}%</span>
					{renderJob.deliveryStatus && <em>Delivery: {renderJob.deliveryStatus}</em>}
					{renderJob.recipientEmail && <em>To: {renderJob.recipientEmail}</em>}
					{renderJob.driveConfigured && renderJob.driveLink && <a href={renderJob.driveLink}>Drive link</a>}
					{renderJob.error && <em>{renderJob.error}</em>}
					{renderJob.deliveryError && <em>{renderJob.deliveryError}</em>}
					{renderJob.downloadUrl && <a href={renderJob.downloadUrl}>Download MP4</a>}
				</div>
			)}
			<div className="editor-layout">
				<section className="builder-main editor-form">
					<div className="section-heading">
						<div>
							<p className="eyebrow">Template builder</p>
							<h1>{title}</h1>
						</div>
					</div>
					<div className="builder-settings">
						<label className="builder-field wide">
							<span>Template title</span>
							<input value={title} onChange={(e) => setTitle(e.target.value)} />
						</label>
						<label className="builder-field wide">
							<span>Source video</span>
							<select
								disabled={sourceVideoDisabled}
								value={videoSlug || ''}
								onChange={(e) => setVideoSlug(e.target.value || null)}
							>
								<option value="">No video</option>
								{videos.map((video) => (
									<option value={video.slug} key={video.slug}>
										{video.slug}
										{video.hasTokens ? ' · captions ready' : ''}
									</option>
								))}
							</select>
						</label>
						<label className="builder-field wide">
							<span>Hook text</span>
							<input disabled={!intro} value={hookText} onChange={(e) => setHookText(e.target.value)} />
						</label>
						<div className="toggle-row">
							<label>
								<input checked={intro} onChange={(e) => setIntro(e.target.checked)} type="checkbox" /> Intro
							</label>
							<label>
								<input checked={outro} onChange={(e) => setOutro(e.target.checked)} type="checkbox" /> Outro
							</label>
							<label>
								<input
									checked={videoBased}
									onChange={(e) => {
										setVideoBased(e.target.checked);
										if (!e.target.checked) setCaption(false);
									}}
									type="checkbox"
								/>{' '}
								Video-based
							</label>
							<label>
								<input
									checked={caption}
									disabled={!videoBased}
									onChange={(e) => setCaption(e.target.checked)}
									type="checkbox"
								/>{' '}
								Captions
							</label>
						</div>
					</div>
					<section className="form-section">
						<h2>Theme</h2>
						<ThemeEditor
							theme={theme}
							onChange={(key, value) => setTheme((current) => ({ ...current, [key]: value }))}
						/>
					</section>
					<section className="form-section">
						<div className="section-heading">
							<h2>Scenes</h2>
							<button className="secondary" onClick={() => setSegments((current) => [...current, newSegment()])}>
								Add scene
							</button>
						</div>
						{segments.map((segment, index) => (
							<SegmentEditor
								key={index}
								index={index}
								segment={segment}
								segmentCount={segments.length}
								theme={theme}
								videoBased={videoBased}
								onUpdate={updateSegment}
								onMove={move}
								onDuplicate={(i) =>
									setSegments((current) => [...current.slice(0, i + 1), { ...current[i] }, ...current.slice(i + 1)])
								}
								onRemove={(i) =>
									setSegments((current) => (current.length > 1 ? current.filter((_, index) => index !== i) : current))
								}
							/>
						))}
					</section>
				</section>
				<aside className="editor-sidebar">
					<section className="preview-panel">
						<div className="section-heading">
							<h2>Live preview</h2>
							<span>{Math.round(durationInFrames / FPS)}s</span>
						</div>
						<div className="preview-player">
							<Player
								acknowledgeRemotionLicense
								component={InfographicVideo}
								inputProps={{ template, videoSrc: previewVideoSrc, transcriptPages: tokens, mediaMode: 'preview' }}
								durationInFrames={durationInFrames}
								compositionWidth={VIDEO_WIDTH}
								compositionHeight={VIDEO_HEIGHT}
								fps={FPS}
								controls
								alwaysShowControls
								overflowVisible
								style={{ width: '100%', height: '100%' }}
							/>
						</div>
					</section>
					<JsonPanel
						copied={copied}
						json={jsonDraft}
						jsonError={jsonError}
						onJsonChange={changeJson}
						onCopy={() => {
							void navigator.clipboard.writeText(jsonDraft);
							setCopied(true);
						}}
					/>
				</aside>
			</div>
		</main>
	);
};
