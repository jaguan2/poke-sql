import { pokemonSprite } from "../../shared/pokemon/sprites";
import type { CapturedPokemon, CollectionCommand } from "./types";

export function ActiveParty({ ids, captures, busy, onCommand, onSelect }: {
  ids: readonly string[]; captures: ReadonlyMap<string, CapturedPokemon>; busy: boolean;
  onCommand: (command: CollectionCommand) => Promise<boolean>; onSelect: (capture: CapturedPokemon) => void;
}) {
  return <section className="pc-party" aria-label="Active party"><details>
    <summary><strong>Active party</strong> <span>{ids.length}/6</span></summary>
    <p className="pc-note">Select a Pokémon in your PC to add it. The first member is your leader. Your Trainer ID showcase is separate.</p>
    {!ids.length && <p className="pc-note">Your party is empty.</p>}
    <ol className="pc-party-list">{ids.map((id, position) => {
      const capture = captures.get(id);
      if (!capture) return null;
      const name = capture.nickname || capture.pokemon.name;
      return <li key={id} aria-label={`Party member ${position + 1}: ${name}`}>
        <button className="pc-party-member" onClick={() => onSelect(capture)}>
          <img src={pokemonSprite(capture.pokemon.id, capture.shiny)} width={56} height={56} alt="" />
          <span>{name}<small>{position === 0 ? "Leader" : `Member ${position + 1}`}{capture.level !== null && ` · Lv. ${capture.level}`}{capture.shiny && " · ✦ Shiny"}</small></span>
        </button>
        <div className="pc-party-actions">
          <button className="btn" disabled={busy || position === 0} aria-label={`Move ${name} earlier in party`} onClick={() => void onCommand({ type: "party-reorder", id, direction: "earlier" })}>↑</button>
          <button className="btn" disabled={busy || position === ids.length - 1} aria-label={`Move ${name} later in party`} onClick={() => void onCommand({ type: "party-reorder", id, direction: "later" })}>↓</button>
          {position > 0 && <button className="btn" disabled={busy} onClick={() => void onCommand({ type: "party-leader", id })}>Make leader</button>}
          <button className="btn" disabled={busy} onClick={() => void onCommand({ type: "party-remove", id })}>Remove from party</button>
        </div>
      </li>;
    })}</ol>
  </details></section>;
}
