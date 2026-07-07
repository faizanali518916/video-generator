import { continueRender, delayRender } from 'remotion';
import { useEffect, useRef } from 'react';

const loadCustomFonts = async () => {
	if (typeof document === 'undefined' || !document.fonts) return;

	await Promise.all([
		document.fonts.load('400 1em Gued'),
		document.fonts.load('700 1em Gued'),
		document.fonts.load('950 1em Gued'),
		document.fonts.load('400 1em Poppins'),
		document.fonts.ready,
	]);
};

export const FontGate = () => {
	const handleRef = useRef<number | null>(null);

	if (handleRef.current === null) {
		handleRef.current = delayRender('Loading custom fonts');
	}

	useEffect(() => {
		const handle = handleRef.current;
		if (handle === null) return;

		loadCustomFonts()
			.catch((error) => {
				console.warn('[fonts] Failed to preload custom fonts before render.', error);
			})
			.finally(() => {
				continueRender(handle);
			});
	}, []);

	return null;
};
