import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		allowedHosts: ['unfinishable-supernumerously-briggs.ngrok-free.dev'],
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:4174',
				changeOrigin: true,
			},
		},
	},
});
