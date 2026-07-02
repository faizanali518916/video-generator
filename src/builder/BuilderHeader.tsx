type BuilderHeaderProps = {
	copied: boolean;
	onSave: () => void;
	projectMessage: string;
	projectStatus: 'idle' | 'saving' | 'saved' | 'error';
};

export const BuilderHeader = ({ copied, onSave, projectMessage, projectStatus }: BuilderHeaderProps) => (
	<div className="builder-topbar">
		<div>
			<p className="builder-kicker">Project editor</p>
			<h1>Database Studio</h1>
			{projectMessage ? <p className={`builder-status ${projectStatus}`}>{projectMessage}</p> : null}
		</div>
		<div className="builder-actions">
			<button className="builder-secondary" onClick={onSave} type="button">
				{projectStatus === 'saving' ? 'Saving' : 'Save project'}
			</button>
			<button className="builder-primary" type="submit">
				{copied ? 'Copied' : 'Copy JSON'}
			</button>
		</div>
	</div>
);
