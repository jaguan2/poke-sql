import "./SafariCommands.css";
import type { ReactNode } from "react";

export function SafariCommands({ busy, queryOpen, ballTheme, onCatch, onLeave, prompt }: {
  busy: boolean; queryOpen: boolean; ballTheme: string; onCatch: () => void; onLeave: () => void; prompt?: ReactNode;
}) {
  return <div className="safari-command-menu" role="group" aria-label="Encounter commands" onKeyDown={event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || busy) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const next = buttons.find(button => button !== document.activeElement);
    if (next) { event.preventDefault(); next.focus(); }
  }}>
    <p>{busy ? "Checking your SQL…" : prompt ?? (queryOpen ? "Write your SQL." : "What will you do?")}</p>
    <div>
      <button type="button" disabled={busy} aria-label={queryOpen ? "Back to encounter menu" : "Catch Pokémon"} onClick={onCatch}>
        <img src={`${import.meta.env.BASE_URL}sprites/items/${ballTheme}.png`} alt="" width={24} height={24} />{queryOpen ? "Back" : "Catch"}
      </button>
      <button type="button" disabled={busy} aria-label="Run away" onClick={onLeave}>Run</button>
    </div>
  </div>;
}
