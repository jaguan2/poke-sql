import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SAFARI_ZONES, WEATHER, featuredZone, weatherFor, zoneById } from "./zones";
import type { Direction, ZoneId } from "./zones";
import type { SafariFleeLimit, SafariPhase, SafariSession } from "./types";
import { safariAssignment } from "./assignments";
import { SAFARI_BALL_ANIMATION_MS, safariThrowTrajectory } from "./animation";
import { TRAINER_THROW } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";
import { SafariMap } from "./SafariMap";
import { SafariFieldGuide } from "./SafariFieldGuide";
import { SafariBattleScene } from "./SafariBattleScene";
import { SafariPokedexEntry } from "./SafariPokedexEntry";
import { SafariEvents } from "./SafariEvents";
import { SafariFledSummary } from "./SafariFledSummary";
import type { QueryResult } from "../../shared/sql/types";
import { QueryResults } from "../../shared/ui/QueryResults";
import "./SafariZone.css";

export function SafariZone({ session, phase, today, busy, saveError, fleeAfter, results, error, message, editor, onMove, onZone, onSubmit, onStop, onLeave, onPokedex, onPc, registeredIds, ballTheme, trainer }: {
  session: SafariSession; phase: SafariPhase; today: string; busy: boolean; saveError: boolean; fleeAfter: SafariFleeLimit; registeredIds: readonly number[]; ballTheme: string; trainer: TrainerId;
  results: QueryResult[]; error: string; message: string; editor: ReactNode;
  onMove: (direction: Direction) => void; onZone: (id: ZoneId) => void; onSubmit: () => void;
  onStop: () => void; onLeave: () => void; onPokedex: () => void; onPc: () => void;
}) {
  const zone = zoneById(session.zoneId);
  const featured = featuredZone(today);
  const weather = weatherFor(zone, today);
  const areas = useRef<HTMLDetailsElement>(null);
  const species = zone.species.find(species => species.id === session.encounter?.pokemonId);
  const assignment = species && session.encounter ? safariAssignment(session.encounter.assignmentId, species) : null;
  const roaming = phase === "roaming";
  const exploring = roaming || phase === "rustling";
  const encounter = session.encounter;
  const remaining = encounter?.fleeAfter == null ? null : encounter.fleeAfter - encounter.attempts;
  const scene = useRef<HTMLDivElement>(null);
  const caughtSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === "caught") {
      caughtSummary.current?.scrollIntoView({ block: "nearest" });
      caughtSummary.current?.focus({ preventScroll: true });
    } else scene.current?.scrollIntoView({ block: phase === "catching" ? "center" : "nearest" });
  }, [phase]);
  return <section className={`safari-zone safari-${zone.id}`} style={{ "--safari-accent": zone.accent, "--safari-canopy": zone.canopy, "--safari-ground": zone.ground } as CSSProperties} aria-labelledby="safari-title">
    <header className="safari-heading"><div><h2 id="safari-title">Safari Zone</h2><p>Encounter Pokémon on the route, then complete a SQL task to catch them.</p></div><div className="safari-pass"><span>Pokémon caught</span><strong>{session.catches.toString().padStart(2, "0")}</strong></div></header>
    {saveError && <p className="notice" role="status">Your expedition is available for this session, but this device could not save it. Keep this window open to retain the current encounter.</p>}
    <details className="safari-area-picker" ref={areas}><summary><strong>{zone.icon} {zone.name}</strong><span>Choose from {SAFARI_ZONES.length} habitats</span></summary><nav className="safari-zones" aria-label="Safari areas">{SAFARI_ZONES.map(area => <button key={area.id} aria-pressed={area.id === session.zoneId} disabled={!roaming || busy} onClick={() => { onZone(area.id); if (areas.current) { areas.current.open = false; areas.current.querySelector("summary")?.focus(); } }}><span>{area.icon}</span><strong>{area.name}</strong><small>{area.id === featured ? "★ Featured today" : "Open to explore"}</small></button>)}</nav></details>
    <div className="safari-day-note">All areas stay open. Today's featured area: <strong>{zoneById(featured).name}</strong><span>{today} · UTC</span></div>
    {exploring && <p className="safari-rules">{fleeAfter === null ? "Relaxed practice · Unlimited attempts" : `Wild Pokémon flee after ${fleeAfter} incorrect answers`}. Change this in Settings.</p>}
    {exploring && <SafariEvents date={today} disabled={!roaming || busy} previousId={session.lastCatch?.pokemon.id} onZone={onZone} />}
    {exploring ? <div className="safari-expedition"><div className="safari-field"><div className="safari-field-heading"><strong>{zone.routeName}</strong><span className="safari-live">{WEATHER[weather].icon} {WEATHER[weather].name}</span></div><SafariMap trainer={trainer} zone={zone} session={session} active={roaming && !busy} rustling={phase === "rustling"} weather={weather} onMove={onMove} /><div className="safari-ranger-note"><span aria-hidden="true">✦</span><p><strong>{{ grass: "Follow the rustling grass.", sand: "Investigate the shifting sand.", stone: "Look for moving stones.", snow: "Follow tracks in the snow." }[zone.encounterTerrain]}</strong> Follow the trail or explore the wild patches. Walk onto the sparkle for a guaranteed encounter; it moves after each catch. Open Route map to plan your way.</p></div></div>
      <SafariFieldGuide zone={zone} registeredIds={registeredIds} weather={weather} previousId={session.lastCatch?.pokemon.id} date={today} />
    </div> : species && assignment && encounter && <section className={`safari-encounter is-${phase}`} aria-labelledby="safari-wild-name" style={{ ...safariThrowTrajectory(trainer), "--safari-catch-duration": `${SAFARI_BALL_ANIMATION_MS}ms`, "--safari-release-delay": `${TRAINER_THROW.releaseDelayMs}ms` } as CSSProperties}>
      <SafariBattleScene trainer={trainer} ref={scene} key={encounter.id} species={species} zone={zone} phase={phase} encounter={encounter} registered={registeredIds.includes(species.id)} ballTheme={ballTheme} />
      {phase === "entering" || phase === "catching" ? <p className="safari-entering-note">{phase === "catching" ? "Catching Pokémon…" : "Starting encounter…"}</p> : phase === "fled" ? <SafariFledSummary name={species.name} attempts={encounter.attempts} assignment={assignment} draft={session.draft} feedback={message} results={results} onLeave={onLeave} /> : phase === "caught" ? <div className="safari-catch-summary" ref={caughtSummary} tabIndex={-1} role="region" aria-label="Caught Pokémon details"><SafariPokedexEntry pokemon={session.lastCatch!.pokemon} /><p>{message || `${species.name} is registered in your collection.`} Completed in {encounter.attempts} {encounter.attempts === 1 ? "query" : "queries"}.</p><div><button className="btn btn-primary" onClick={onLeave}>Keep exploring</button><button className="btn" onClick={onPokedex}>View Pokédex</button><button className="btn" onClick={onPc}>Open PC Boxes</button></div></div> : <div className="safari-assignment"><div className="safari-assignment-heading"><div><span className="eyebrow">{assignment.topic}</span><h3>{assignment.title}</h3></div><button className="btn" disabled={busy} onClick={onLeave}>Return to trail</button></div><p>{assignment.prompt}</p>
        <div className="safari-chances" data-urgent={remaining !== null && remaining <= 2} role="status">
          <strong>{remaining === null ? "Unlimited attempts" : `${remaining} ${remaining === 1 ? "chance" : "chances"} remaining`}</strong>
          {remaining !== null && <progress max={encounter.fleeAfter!} value={remaining} aria-label="Catch chances remaining" />}
          <span>{remaining === null ? "Take your time. This Pokémon will stay while you practice." : `Flees after ${encounter.fleeAfter} incorrect answers. Hints, SQL errors and stopped queries keep your chances.`}</span>
        </div>
        <details><summary>Need a hint?</summary><p>{assignment.hint}</p></details>
        {editor}
        <div className="safari-query-actions">{busy ? <button className="btn btn-primary" onClick={onStop}>■ Stop catch query</button> : <button className="btn btn-primary" onClick={onSubmit} disabled={!session.draft.trim()}>Check query & catch <kbd>Ctrl+Enter</kbd></button>}<span>{encounter.attempts} checked {encounter.attempts === 1 ? "query" : "queries"}</span></div>
        {error && <p className="error-panel" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
        {results.length > 0 && <div className="safari-query-results"><h4>Last checked query results</h4><QueryResults results={results} /></div>}
        <small>Your assignment uses the original Pokédex. Wrong answers and returning to the trail never add discoveries.</small>
      </div>}
    </section>}
    <details className="safari-credits"><summary>Safari art &amp; controls</summary><p>Route sections and field effects come from Pokémon Emerald. Red and Leaf's trainer sprites, battle terrain, window frames and pixel lettering come from Pokémon FireRed/LeafGreen, archived by the <a href="https://github.com/pret/pokefirered" target="_blank" rel="noreferrer">pret project</a>. Pokémon sprites come from PokéAPI. Palettes, route sections and walking collisions are adapted for PokéSQL, with its own camera, weather and SQL encounters. All assets are bundled locally. WASD and arrow keys work while exploring; open menus and typing pause walking, and reduced-motion preferences skip the battle animations.</p></details>
  </section>;
}
