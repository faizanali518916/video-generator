import { Composition } from 'remotion';
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH, getTemplateDurationInFrames } from '../layoutCatalog';
import { createDefaultTemplate } from '../shared/defaults';
import { InfographicVideo } from '../video/InfographicVideo';

export const RemotionRoot = () => {
	const template = createDefaultTemplate();
	return (
		<Composition
			id="project-render"
			component={InfographicVideo}
			width={VIDEO_WIDTH}
			height={VIDEO_HEIGHT}
			fps={FPS}
			durationInFrames={getTemplateDurationInFrames(template, FPS)}
			defaultProps={{ template, transcriptPages: [], mediaMode: 'render' as const }}
			calculateMetadata={({ props }) => ({ durationInFrames: getTemplateDurationInFrames(props.template, FPS) })}
		/>
	);
};
