/** Run and Stop share one button so keyboard focus survives query execution. */
export function QueryAction({ busy, disabled, onRun, onStop, runAriaLabel, stopLabel = "Stop query", className = "" }: {
  busy: boolean; disabled?: boolean; onRun: () => void; onStop: () => void;
  runAriaLabel?: string; stopLabel?: string; className?: string;
}) {
  return <button type="button" className={`btn btn-primary query-action ${className}`} data-busy={busy}
    disabled={!busy && disabled} aria-label={busy ? `■ ${stopLabel}` : runAriaLabel} onClick={busy ? onStop : onRun}>
    <span className="query-action-icon" aria-hidden="true">
      <svg className="motion-icon" data-active={!busy} viewBox="0 0 20 20"><path d="m6 3 11 7-11 7Z" fill="currentColor" /></svg>
      <svg className="motion-icon" data-active={busy} viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="1" fill="currentColor" /></svg>
    </span>
    <span>{busy ? stopLabel : "Run query"}</span><kbd hidden={busy}>Ctrl+Enter</kbd>
  </button>;
}
