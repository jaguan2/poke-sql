import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SAFARI_ZONES, featuredZone, zoneById } from "./zones";
import type { Direction, ZoneId } from "./zones";
import type { SafariPhase, SafariSession } from "./types";
import { safariAssignment } from "./assignments";
import { SafariMap, TrainerSprite } from "./SafariMap";
import type { QueryResult } from "../../shared/sql/types";
import { QueryResults } from "../../shared/ui/QueryResults";
import "./SafariZone.css";

export function SafariZone({ session, phase, today, busy, saveError, results, error, message, editor, onMove, onZone, onSubmit, onStop, onLeave, onPokedex }: {
  session: SafariSession; phase: SafariPhase; today: string; busy: boolean; saveError: boolean;
  results: QueryResult[]; error: string; message: string; editor: ReactNode;
  onMove: (direction: Direction) => void; onZone: (id: ZoneId) => void; onSubmit: () => void;
  onStop: () => void; onLeave: () => void; onPokedex: () => void;
}) {
  const zone = zoneById(session.zoneId);
  const featured = featuredZone(today);
  const species = zone.species.find(species => species.id === session.encounter?.pokemonId);
  const assignment = species && session.encounter ? safariAssignment(session.encounter.assignmentId, species) : null;
  const roaming = phase === "roaming";
  const scene = useRef<HTMLDivElement>(null);
  const caughtSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Touch controls sit below the map. Bring the encounter into view when
    // it replaces that map, rather than playing the entrance off-screen.
    if (phase === "entering" || phase === "battle") scene.current?.scrollIntoView({ block: "nearest" });
    if (phase === "caught") caughtSummary.current?.scrollIntoView({ block: "nearest" });
  }, [phase]);
  return <section className={`safari-zone safari-${zone.id}`} style={{ "--safari-accent": zone.accent, "--safari-canopy": zone.canopy } as CSSProperties} aria-labelledby="safari-title">
    <header className="safari-heading"><div><span className="eyebrow">A little SQL. A little adventure.</span><h2 id="safari-title">Safari Zone<span>Field expedition</span></h2><p>Explore the tall grass. Meet a Pokémon. Complete its SQL assignment to make the catch.</p></div><div className="safari-pass"><span>EXPLORER PASS</span><strong>{session.catches.toString().padStart(2, "0")}</strong><small>SQL catches</small></div></header>
    {saveError && <p className="notice" role="status">Your expedition is available for this session, but this device could not save it. Keep this window open to retain the current encounter.</p>}
    <nav className="safari-zones" aria-label="Safari areas">{SAFARI_ZONES.map(area => <button key={area.id} aria-pressed={area.id === session.zoneId} disabled={!roaming || busy} onClick={() => onZone(area.id)}><span>{area.id === "forest" ? "♧" : area.id === "wetlands" ? "≈" : "◇"}</span><strong>{area.name}</strong><small>{area.id === featured ? "★ Featured today" : "Open to explore"}</small></button>)}</nav>
    <div className="safari-day-note">All areas stay open. Today's featured area: <strong>{zoneById(featured).name}</strong><span>{today} · UTC</span></div>
    {roaming ? <div className="safari-expedition"><div className="safari-field"><div className="safari-field-heading"><span>01 / EXPLORE</span><strong>{zone.name}</strong><span className="safari-live">● Trail open</span></div><SafariMap zone={zone} session={session} active={!busy} onMove={onMove} /><div className="safari-ranger-note"><span aria-hidden="true">✦</span><p><strong>Follow the rustling grass.</strong> Walk onto the sparkling patch for a guaranteed encounter. Other tall grass can hide Pokémon too.</p></div></div>
      <aside className="safari-field-guide" aria-label={`${zone.name} encounter pool`}><span className="eyebrow">02 / FIELD GUIDE</span><h3>Who lives here?</h3><p>{zone.description}</p><div className="safari-pool">{zone.species.map(pokemon => <div key={pokemon.id}><img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={40} height={40} loading="lazy" /><span><strong>{pokemon.name}</strong><small>{pokemon.rarity}</small></span></div>)}</div><small className="safari-guide-note">Common species appear more often. Each species counts once toward your Pokédex and achievements.</small></aside>
    </div> : species && assignment && <section className={`safari-encounter ${phase === "entering" ? "is-entering" : ""} ${phase === "caught" ? "is-caught" : ""}`} aria-labelledby="safari-wild-name">
      <div className="safari-battle-scene" ref={scene} key={session.encounter!.id} aria-label={`Wild ${species.name} encounter`}>
        <div className="safari-battle-horizon" /><div className="safari-opponent-platform" /><div className="safari-trainer-platform" />
        <div className="safari-wild-card"><span>{phase === "caught" ? "CATCH COMPLETE" : "WILD ENCOUNTER"}</span><h3 id="safari-wild-name">{species.name}<small>#{String(species.id).padStart(4, "0")}</small></h3><p>{species.rarity} · {zone.name}</p></div>
        <img className="safari-wild-sprite" src={`${import.meta.env.BASE_URL}sprites/${species.id}.png`} alt={`Wild ${species.name}`} width={144} height={144} />
        <TrainerSprite frame={1} className="safari-battle-trainer" />
        <div className="safari-encounter-caption" role="status">{phase === "entering" ? "The grass is stirring…" : phase === "caught" ? `Gotcha! ${species.name} was caught!` : `A wild ${species.name} appeared!`}</div>
        {phase === "entering" && <div className="safari-battle-wipe" aria-hidden="true"><span /><span /></div>}
        {phase === "caught" && <img className="safari-catch-ball" src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} alt="" width={48} height={48} />}
      </div>
      {phase === "entering" ? <p className="safari-entering-note">Opening your field notebook…</p> : phase === "caught" ? <div className="safari-catch-summary" ref={caughtSummary}><span className="eyebrow">Assignment complete</span><h3>A new story for your Pokédex.</h3><p>{message || `${species.name} is registered in your collection.`} Completed in {session.encounter!.attempts} {session.encounter!.attempts === 1 ? "query" : "queries"}.</p><div><button className="btn btn-primary" onClick={onLeave}>Keep exploring</button><button className="btn" onClick={onPokedex}>View Pokédex</button></div></div> : <div className="safari-assignment"><div className="safari-assignment-heading"><div><span className="eyebrow">03 / MAKE THE CATCH · {assignment.topic}</span><h3>{assignment.title}</h3></div><button className="btn" disabled={busy} onClick={onLeave}>Return to trail</button></div><p>{assignment.prompt}</p><details><summary>Need a hint?</summary><p>{assignment.hint}</p></details>
        {editor}
        <div className="safari-query-actions">{busy ? <button className="btn btn-primary" onClick={onStop}>■ Stop catch query</button> : <button className="btn btn-primary" onClick={onSubmit} disabled={!session.draft.trim()}>Check query & catch <kbd>Ctrl+Enter</kbd></button>}<span>{session.encounter!.attempts} checked {session.encounter!.attempts === 1 ? "query" : "queries"} · No catch limit</span></div>
        {error && <p className="error-panel" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
        {results.length > 0 && <div className="safari-query-results"><h4>Last checked query results</h4><QueryResults results={results} /></div>}
        <small>Your assignment uses the original Pokédex. Wrong answers and returning to the trail never add discoveries.</small>
      </div>}
    </section>}
    <details className="safari-credits"><summary>Safari art &amp; controls</summary><p>Trainer walking sprite from Pokémon Emerald, archived by the <a href="https://github.com/pret/pokeemerald" target="_blank" rel="noreferrer">pret project</a>. Pokémon sprites come from PokéAPI. Terrain and interface art were made for PokéSQL. All assets are bundled locally. Movement keys work while the map is focused; reduced-motion preferences skip the entrance animation.</p></details>
  </section>;
}
