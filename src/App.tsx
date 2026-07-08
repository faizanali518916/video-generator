import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ProjectEditorPage } from './app/ProjectEditorPage';
import { ProjectsPage } from './app/ProjectsPage';
import { RendersPage } from './app/RendersPage';
import { VideoDetailPage } from './app/VideoDetailPage';
import { VideosPage } from './app/VideosPage';

const Navigation = () => (
	<header className="sticky top-0 z-50 flex items-center justify-between border-b border-sky-200/15 bg-slate-950/85 px-5 py-3 text-white backdrop-blur-2xl sm:px-8 lg:px-[5vw]">
		<a className="font-black no-underline" href="/projects">
			Dynamic Video Generator
		</a>
		<nav className="flex gap-2">
			<NavLink
				className={({ isActive }) =>
					`rounded-full border px-3.5 py-2 text-indigo-100 no-underline ${
						isActive ? 'border-indigo-300/35 bg-indigo-500/20 text-white' : 'border-transparent'
					}`
				}
				to="/projects"
			>
				Projects
			</NavLink>
			<NavLink
				className={({ isActive }) =>
					`rounded-full border px-3.5 py-2 text-indigo-100 no-underline ${
						isActive ? 'border-indigo-300/35 bg-indigo-500/20 text-white' : 'border-transparent'
					}`
				}
				to="/videos"
			>
				Videos
			</NavLink>
			<NavLink
				className={({ isActive }) =>
					`rounded-full border px-3.5 py-2 text-indigo-100 no-underline ${
						isActive ? 'border-indigo-300/35 bg-indigo-500/20 text-white' : 'border-transparent'
					}`
				}
				to="/renders"
			>
				Renders
			</NavLink>
		</nav>
	</header>
);

export const App = () => (
	<div className="min-h-screen bg-[#050816] font-sans text-white">
		<Navigation />
		<Routes>
			<Route path="/" element={<Navigate to="/projects" replace />} />
			<Route path="/projects" element={<ProjectsPage />} />
			<Route path="/projects/:slug" element={<ProjectEditorPage />} />
			<Route path="/videos" element={<VideosPage />} />
			<Route path="/videos/:slug" element={<VideoDetailPage />} />
			<Route path="/renders" element={<RendersPage />} />
			<Route path="*" element={<Navigate to="/projects" replace />} />
		</Routes>
	</div>
);
