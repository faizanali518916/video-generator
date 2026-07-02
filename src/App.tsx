import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ProjectEditorPage } from './app/ProjectEditorPage';
import { ProjectsPage } from './app/ProjectsPage';
import { VideoDetailPage } from './app/VideoDetailPage';
import { VideosPage } from './app/VideosPage';

const Navigation = () => (
	<header className="app-nav">
		<a className="app-brand" href="/projects">
			<img src="/logo.png" alt="" /> Video Generator
		</a>
		<nav>
			<NavLink to="/projects">Projects</NavLink>
			<NavLink to="/videos">Videos</NavLink>
		</nav>
	</header>
);

export const App = () => (
	<div className="app-shell">
		<Navigation />
		<Routes>
			<Route path="/" element={<Navigate to="/projects" replace />} />
			<Route path="/projects" element={<ProjectsPage />} />
			<Route path="/projects/:slug" element={<ProjectEditorPage />} />
			<Route path="/videos" element={<VideosPage />} />
			<Route path="/videos/:slug" element={<VideoDetailPage />} />
			<Route path="*" element={<Navigate to="/projects" replace />} />
		</Routes>
	</div>
);
