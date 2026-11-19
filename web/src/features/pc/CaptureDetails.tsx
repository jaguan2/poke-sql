import { TypeBadge } from "../../shared/pokemon/TypeBadge";
import type { CapturedPokemon, Collection, CollectionCommand } from "./types";

export function CaptureDetails({ capture, collection, busy, moving, onCommand, onMove, onProfile }: {
  capture: CapturedPokemon; collection: Collection; busy: boolean; moving: boolean;
  onCommand: (command: CollectionCommand) => Promise<boolean>; onMove: () => void; onProfile: () => void;
}) {
  const featured = collection.featuredIds.includes(capture.id);
  const toggleFeatured = () => onCommand({ type: "featured", ids: featured ? collection.featuredIds.filter(id => id !== capture.id) : [...collection.featuredIds, capture.id] });
  return <section className="pc-summary" aria-label="Selected Pokémon">
    <div className="pc-portrait"><img src={`${import.meta.env.BASE_URL}sprites/${capture.pokemon.id}.png`} alt={capture.pokemon.name} width={144} height={144} /></div>
    <h3>{capture.nickname || capture.pokemon.name}</h3>
    {capture.nickname && <p>{capture.pokemon.name}</p>}
    <p>{capture.level === null ? "Level unknown" : `Lv. ${capture.level}`}{capture.favorite && " · ★ Favorite"}</p>
    <div className="pc-types"><TypeBadge type={capture.pokemon.type1} />{capture.pokemon.type2 && <TypeBadge type={capture.pokemon.type2} />}</div>
    <dl className="pc-capture-facts">
      <div><dt>Box</dt><dd>{collection.boxes.find(box => box.id === capture.boxId)?.name} · slot {capture.slot + 1}</dd></div>
      <div><dt>{capture.caughtAt ? "Caught" : "First recorded"}</dt><dd>{new Date(capture.caughtAt ?? capture.firstRecordedAt).toLocaleDateString()}</dd></div>
      <div><dt>Source</dt><dd>{{ safari: "Safari Zone", daily: "Daily mystery", random: "Random mystery", legacy: "Imported progress" }[capture.source]}{capture.location && ` · ${capture.location}`}</dd></div>
      {capture.ball && <div><dt>Ball</dt><dd><img src={`${import.meta.env.BASE_URL}sprites/items/${capture.ball}.png`} width={24} height={24} alt={capture.ball.replace(/-/g, " ")} /></dd></div>}
      <div><dt>{capture.source === "legacy" ? "Best recorded attempts" : "Attempts"}</dt><dd>{capture.attempts}</dd></div>
    </dl>
    <form key={`${capture.id}:${capture.nickname}`} className="pc-name-form" onSubmit={event => {
      event.preventDefault(); void onCommand({ type: "nickname", id: capture.id, name: String(new FormData(event.currentTarget).get("nickname") ?? "") });
    }}><label>Nickname<input name="nickname" maxLength={24} defaultValue={capture.nickname} placeholder={capture.pokemon.name} disabled={busy} /></label><button className="btn" disabled={busy}>Save nickname</button></form>
    <div className="pc-summary-actions">
      <button className="btn" disabled={busy} aria-pressed={capture.favorite} onClick={() => void onCommand({ type: "favorite", id: capture.id, favorite: !capture.favorite })}>Favorite</button>
      <button className="btn" disabled={busy} onClick={onMove}>{moving ? "Cancel move" : "Move Pokémon"}</button>
      <button className="btn" disabled={busy || (!featured && collection.featuredIds.length >= 6)} aria-pressed={featured} onClick={() => void toggleFeatured()}>{featured ? "Remove from profile" : "Feature on profile"}</button>
      <button className="btn" onClick={onProfile}>View Trainer ID</button>
    </div>
    <p className="pc-note">{collection.featuredIds.length}/6 Pokémon featured on your profile.</p>
    {capture.source === "legacy" && <p className="pc-note">Older saves contain one record per species. Original level, ball and duplicate catches are unavailable.</p>}
    {capture.sql && <details className="pc-catch-query"><summary>Catch query</summary><pre><code>{capture.sql}</code></pre></details>}
  </section>;
}
