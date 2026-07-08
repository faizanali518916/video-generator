import type { Theme } from '../layoutCatalog';

type ThemeEditorProps = {
	onChange: (key: keyof Theme, value: string) => void;
	theme: Theme;
};

const themeLabel = (key: keyof Theme): string => (key === 'background' ? 'backdrop' : key);

export const ThemeEditor = ({ onChange, theme }: ThemeEditorProps) => (
	<div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
		{(Object.keys(theme) as Array<keyof Theme>).map((key) => (
			<label className="grid gap-1" key={key}>
				<span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-100/70">{themeLabel(key)}</span>
				<input
					className="theme-color-input w-full cursor-pointer"
					onChange={(event) => onChange(key, event.target.value)}
					type="color"
					value={theme[key]}
				/>
			</label>
		))}
	</div>
);
