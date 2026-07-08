import {
	LAYOUT_SPECS,
	MAX_VIDEO_SCENE_DURATION_SECONDS,
	MIN_VIDEO_SCENE_DURATION_SECONDS,
	layoutKinds,
	type LayoutKind,
	type Theme,
} from '../layoutCatalog';
import { field, fieldLabel, input, panel } from '../ui';
import type { FormSegment } from './types';

type SegmentEditorProps = {
	index: number;
	onUpdate: (index: number, key: keyof FormSegment, value: FormSegment[keyof FormSegment]) => void;
	segment: FormSegment;
	theme: Theme;
	videoBased: boolean;
};

const itemCountLabel = (layout: LayoutKind): string => {
	const spec = LAYOUT_SPECS[layout];

	return spec.minItems === spec.maxItems ? `${spec.minItems} items` : `${spec.minItems}-${spec.maxItems} items`;
};

const durationRangeLabel = (layout: LayoutKind): string => {
	const spec = LAYOUT_SPECS[layout];

	return `${spec.minDurationSeconds}-${spec.maxDurationSeconds}s`;
};

export const SegmentEditor = ({
	index,
	onUpdate,
	segment,
	theme,
	videoBased,
}: SegmentEditorProps) => {
	const spec = LAYOUT_SPECS[segment.layout];
	const durationLabel = segment.videoShown ? 'Duration' : `Duration (${durationRangeLabel(segment.layout)})`;
	const minDuration = segment.videoShown ? MIN_VIDEO_SCENE_DURATION_SECONDS : spec.minDurationSeconds;
	const maxDuration = segment.videoShown ? MAX_VIDEO_SCENE_DURATION_SECONDS : spec.maxDurationSeconds;

	return (
		<article className={`${panel} flex h-full flex-col rounded-[20px] p-6`}>
			<div className="grid gap-x-5 gap-y-2 md:grid-cols-2">
				<label className="flex items-center gap-2">
					<input
						checked={segment.videoShown}
						className="h-6 w-6 cursor-pointer disabled:cursor-default disabled:opacity-35"
						disabled={!videoBased}
						onChange={(event) => onUpdate(index, 'videoShown', event.target.checked)}
						type="checkbox"
					/>
					<span className={fieldLabel}>Video shown</span>
				</label>

				<label className={field}>
					<span className={fieldLabel}>{durationLabel}</span>
					<input
						className={input}
						max={maxDuration}
						min={minDuration}
						onChange={(event) => onUpdate(index, 'durationSeconds', event.target.value)}
						step={0.25}
						type="number"
						value={segment.durationSeconds}
					/>
				</label>

				{segment.videoShown ? null : (
					<>
						<label className={field}>
							<span className={fieldLabel}>Layout</span>
							<select className={input} onChange={(event) => onUpdate(index, 'layout', event.target.value)} value={segment.layout}>
								{layoutKinds.map((layout) => (
									<option key={layout} value={layout}>
										{LAYOUT_SPECS[layout].label} / {itemCountLabel(layout)} / {durationRangeLabel(layout)}
									</option>
								))}
							</select>
						</label>

						<label className={field}>
							<span className={fieldLabel}>Accent</span>
							<input
								className={`${input} !h-[50px] !p-1`}
								onChange={(event) => onUpdate(index, 'accent', event.target.value)}
								type="color"
								value={segment.accent || theme.accent}
							/>
						</label>

						<label className={`${field} md:col-span-2`}>
							<span className={fieldLabel}>Title</span>
							<input
								className={input}
								onChange={(event) => onUpdate(index, 'title', event.target.value)}
								type="text"
								value={segment.title}
							/>
						</label>

						<label className={`${field} md:col-span-2`}>
							<span className={fieldLabel}>Subtitle</span>
							<input
								className={input}
								onChange={(event) => onUpdate(index, 'subtitle', event.target.value)}
								type="text"
								value={segment.subtitle}
							/>
						</label>

						<label className={field}>
							<span className={fieldLabel}>Metric</span>
							<input
								className={input}
								onChange={(event) => onUpdate(index, 'metric', event.target.value)}
								type="text"
								value={segment.metric}
							/>
						</label>

						<label className={field}>
							<span className={fieldLabel}>Values</span>
							<input
								className={input}
								onChange={(event) => onUpdate(index, 'valuesText', event.target.value)}
								placeholder="80, 55, 90"
								type="text"
								value={segment.valuesText}
							/>
						</label>

						<label className={`${field} md:col-span-2`}>
							<span className={fieldLabel}>Items ({itemCountLabel(segment.layout)})</span>
							<textarea
								className={input}
								onChange={(event) => onUpdate(index, 'itemsText', event.target.value)}
								rows={Math.min(spec.maxItems, 7)}
								value={segment.itemsText}
							/>
						</label>
					</>
				)}
			</div>
		</article>
	);
};
