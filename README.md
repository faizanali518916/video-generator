# Video Generator

A local-first React, Tailwind, and Remotion studio for managing source videos, generating timed captions, editing reusable infographic templates, and rendering MP4 files. All persistent data is stored in `projects/`, `videos/`, and `renders/`; there is no database.

## Requirements

- Node.js 22 or newer
- FFmpeg and ffprobe in `PATH`
- A Chromium-compatible browser (Remotion can provision one, or set `REMOTION_BROWSER_EXECUTABLE`)
- Internet access the first time Whisper.cpp and the selected model are installed

On Windows, FFmpeg can be installed with `winget install -e --id Gyan.FFmpeg`.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The API listens on `http://127.0.0.1:4174`.

For a production-style local run:

```powershell
npm run build
npm start
```

Open `http://127.0.0.1:4174`.

## Workflow

1. Upload an MP4 in **Videos**.
2. Open it and run the full caption pipeline.
3. Create a project and select the video.
4. Edit the scenes, theme, or raw JSON and save.
5. Render the project and download the completed MP4.

When a source video is selected, the template stores its project-relative folder path (for example,
`../../videos/my-video`). The renderer uses that folder to load both `video.mp4` and `tokens.json` while
still supporting older templates that only contain `videoSlug`.

Caption and render work runs through one persistent filesystem queue. If the app is stopped during a job, that job is marked failed on the next start and can be retried.

## Commands

- `npm run dev` — Vite UI and watched API server
- `npm run studio` — Remotion Studio
- `npm run build` — TypeScript validation and frontend build
- `npm test` — automated tests
- `npm run lint` — strict TypeScript check

Copy `.env.example` to `.env` to change ports, upload limits, the Whisper model, or the browser executable.
