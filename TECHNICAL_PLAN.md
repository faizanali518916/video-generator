# Video Generator — Technical Implementation Plan

## Outcome

Build a standalone, local single-user React 19 + TypeScript + Tailwind v4 application backed by Remotion 4.0.484. It maintains independent filesystem video and project libraries, generates `video.mp4 → audio.wav → captions.json → tokens.json`, previews templates with Remotion Player, and renders local H.264 MP4 files without a database or cloud services.

## Architecture

- Vite serves the browser application in development; Express exposes the filesystem API and serves the production build.
- `projects/<slug>/template.json` stores `{schemaVersion, name, videoSlug, template}`. `videos/<slug>/` owns source and caption artifacts. `renders/<project-slug>/` owns outputs.
- Shared Zod schemas validate all API input and persisted project JSON. Strict slugs and resolved-path containment prevent traversal.
- Writes use temporary files and rename. Uploads land in `.runtime/uploads`, pass ffprobe validation, and then move into the final video folder.
- A single FIFO worker persists queued/running/completed/failed job manifests beneath `.runtime/jobs`. Interrupted running jobs are failed safely at startup.

## Product Surfaces

- `/videos`: upload, preview, inspect artifact readiness, and safely delete unreferenced source videos.
- `/videos/:slug`: run audio, caption, token, or full generation; optionally force regeneration and downstream invalidation; poll live job state.
- `/projects`: create, browse, and delete filesystem projects.
- `/projects/:slug`: rename, select a video, edit the complete existing template form or raw JSON, preview captions/layouts, save, render, and download.

## Media and Rendering

- FFmpeg extracts mono 16 kHz signed 16-bit WAV.
- Remotion's Whisper.cpp integration installs into the user cache, downloads `medium.en` by default, emits token timestamps, and converts them into 2-second TikTok-style transcript pages.
- The render worker bundles `src/remotion/index.ts`, selects `project-render` with the same props used for rendering, streams local source MP4 through a range-capable endpoint, and reports `renderMedia()` progress.
- The extracted composition retains all twelve layouts, brand assets, intro/outro behavior, captions, and the 1080×1920, 30 FPS timing model from Dynamic Videos.

## Safety and Acceptance

- Reject duplicate/unsafe slugs, malformed templates, empty or invalid MP4 uploads, missing dependencies, duplicate active jobs, and deletion of referenced videos.
- Preserve source videos and renders when projects are deleted. Forced upstream regeneration invalidates stale downstream artifacts.
- Validate with schema/path/store tests, API integration tests, strict TypeScript, a Vite production build, an uploaded-video pipeline, Player caption preview, and a short smoke render.

The original Dynamic Videos repository is a read-only extraction source and remains functionally unchanged.
