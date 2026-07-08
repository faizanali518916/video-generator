import { secondaryButton } from '../ui';

type JsonPanelProps = {
	className?: string;
	copied: boolean;
	json: string;
	jsonError: string | null;
	onCopy: () => void;
	onJsonChange: (value: string) => void;
};

export const JsonPanel = ({ className = '', copied, json, jsonError, onCopy, onJsonChange }: JsonPanelProps) => (
	<aside className={`flex min-h-0 flex-col rounded-[20px] border border-sky-200/20 bg-slate-950/65 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${className}`}>
		<div className="flex items-center justify-between">
			<h2 className="m-0 text-2xl font-black text-white">Current JSON</h2>
			<button className={secondaryButton} onClick={onCopy} type="button">
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>
		<textarea
			aria-invalid={jsonError ? 'true' : 'false'}
			className="no-scrollbar mt-4 min-h-[360px] flex-1 resize-none overflow-auto whitespace-pre rounded-xl border border-sky-200/20 bg-white/[0.06] px-4 py-3 font-mono text-sm text-white outline-none aria-invalid:border-orange-300/75"
			onChange={(event) => onJsonChange(event.target.value)}
			spellCheck={false}
			value={json}
		/>
		{jsonError ? <p className="mt-3 rounded-xl bg-orange-500/10 p-3 text-sm font-bold text-orange-100">{jsonError}</p> : null}
	</aside>
);
