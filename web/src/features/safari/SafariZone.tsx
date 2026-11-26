import { createBag, shinyOdds, SHINY_ODDS } from "./bag-model";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SAFARI_ZONES, WEATHER, encounterSpecies, featuredZone, hasIce, weatherFor, zoneById } from "./zones";
import type { Direction, ZoneId } from "./zones";
import type { SafariFleeLimit, SafariPhase, SafariSession } from "./types";
import { safariAssignment } from "./assignments";
import { isFieldAssignment } from "./field-assignments";
import type { TrainerId } from "../../shared/trainer/profile";
import { SafariMap } from "./SafariMap";
import { SafariSounds } from "./SafariSounds";
import { SafariFieldGuide } from "./SafariFieldGuide";
import { SafariBattleScene } from "./SafariBattleScene";
import { SafariPokedexEntry } from "./SafariPokedexEntry";
import { SafariEvents } from "./SafariEvents";
import { SafariFledSummary } from "./SafariFledSummary";
import { visibleSafariPokemonId } from "./model";
import { RegionMap, RegionTown } from "./RegionMap";
import { regionFor, regionalRoute } from "./regions";
import type { RegionId } from "./regions";
import type { QueryResult } from "../../shared/sql/types";
import { QueryResults } from "../../shared/ui/QueryResults";
import "./SafariZone.css";

export function SafariZone({ session, phase, slideMs, today, busy, saveError, fleeAfter, results, error, message, editor, musicLink, onMove, onZone, onRegion, onHoneyTree, onPreview, onSubmit, onStop, onLeave, onBag, onPokedex, onPc, registeredIds, ballTheme, trainer }: {
  session: SafariSession; phase: SafariPhase; slideMs: number; today: string; busy: boolean; saveError: boolean; fleeAfter: SafariFleeLimit; registeredIds: readonly number[]; ballTheme: string; trainer: TrainerId;
  results: QueryResult[]; error: string; message: string; editor: (controls: ReactNode) => ReactNode; musicLink?: ReactNode;
  onMove: (direction: Direction) => void; onZone: (id: ZoneId) => void; onPreview: () => void; onSubmit: () => void;
  onRegion: (id: RegionId) => void;
  onHoneyTree: () => void;
  onBag: () => void; onStop: () => void; onLeave: () => void; onPokedex: () => void; onPc: () => void;
}) {
  const bag = session.bag ?? createBag();
  const zone = zoneById(session.zoneId);
  const region = regionFor(session.zoneId);
  const safe = zone.species.length === 0;
  const featured = featuredZone(today);
  const weather = weatherFor(zone, today);
  const areas = useRef<HTMLDetailsElement>(null);
  const species = encounterSpecies(zone, session.encounter?.source).find(species => species.id === session.encounter?.pokemonId);
  const assignment = species && session.encounter ? safariAssignment(session.encounter.assignmentId, species) : null;
  const roaming = phase === "roaming";
  const actionsDisabled = !roaming || busy || slideMs > 0;
  const exploring = roaming || phase === "rustling";
  const encounter = session.encounter;
  const [queryEncounterId, setQueryEncounterId] = useState<string>();
  const showQuery = phase === "battle" && encounter?.id === queryEncounterId;
  const fieldwork = isFieldAssignment(encounter?.assignmentId);
  const canSubmit = session.draft.trim().length > 0;
  const remaining = encounter?.fleeAfter == null ? null : encounter.fleeAfter - encounter.attempts;
  const scene = useRef<HTMLDivElement>(null);
  const caughtSummary = useRef<HTMLDivElement>(null);
  const queryPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showQuery) {
      queryPanel.current?.scrollIntoView({ block: "nearest" });
    } else if (phase === "battle") scene.current?.querySelector<HTMLButtonElement>('button[aria-label="Catch Pokémon"]')?.focus({ preventScroll: true });
  }, [showQuery, phase]);
  useEffect(() => {
    if (phase === "caught") {
      caughtSummary.current?.scrollIntoView({ block: "nearest" });
      caughtSummary.current?.focus({ preventScroll: true });
    } else scene.current?.scrollIntoView({ block: phase === "catching" ? "center" : "nearest" });
  }, [phase]);
  return <section className={`safari-zone safari-${zone.id}`} style={{ "--safari-accent": zone.accent, "--safari-canopy": zone.canopy, "--safari-ground": zone.ground } as CSSProperties} aria-labelledby="safari-title">
    <header className="safari-heading"><div><h2 id="safari-title">{region?.name ?? "Safari Zone"}</h2><p>{region ? "Explore towns and routes. Complete SQL tasks to catch Pokémon." : "Encounter Pokémon on the route, then complete a SQL task to catch them."}</p></div><div className="safari-pass"><span>Pokémon caught</span><strong>{session.catches.toString().padStart(2, "0")}</strong></div></header>
    {saveError && <p className="notice" role="status">Your expedition is available for this session, but this device could not save it. Keep this window open to retain the current encounter.</p>}
    <div className="safari-sound-controls"><SafariSounds phase={phase} /></div>
    <RegionMap key={session.zoneId} session={session} disabled={actionsDisabled} registeredIds={registeredIds} onTravel={onZone} onRegion={onRegion} />
    <details className="safari-area-picker" ref={areas}><summary><strong>{region ? "Safari habitats" : `${zone.icon} ${zone.name}`}</strong><span>Choose from {SAFARI_ZONES.length} habitats</span></summary><nav className="safari-zones" aria-label="Safari areas">{SAFARI_ZONES.map(area => <button key={area.id} aria-pressed={area.id === session.zoneId} disabled={actionsDisabled} onClick={() => { onZone(area.id); if (areas.current) { areas.current.open = false; areas.current.querySelector("summary")?.focus(); } }}><span>{area.icon}</span><strong>{area.name}</strong><small>{area.id === featured ? "★ Featured today" : "Open to explore"}</small></button>)}</nav></details>
    {!region && <div className="safari-day-note">Today's featured area: <strong>{zoneById(featured).name}</strong><span>{today} · UTC</span></div>}
    {exploring && !safe && <p className="safari-rules">{fleeAfter === null ? "Relaxed practice · Unlimited attempts" : `Pokémon flee after ${fleeAfter} incorrect answers`}. Change this in Settings.</p>}
    {exploring && <div className="safari-item-bar"><button className="btn" disabled={actionsDisabled} onClick={onBag}>Bag</button><span role="status">{bag.repelSteps > 0 ? `Repel · ${bag.repelSteps} steps left` : "Repel inactive"}{shinyOdds(bag, session.catches) < SHINY_ODDS ? " · Shiny Charm active" : ""}</span></div>}
    {roaming && message && <p className="notice" role="status">{message}</p>}
    {exploring && !region && <SafariEvents date={today} disabled={actionsDisabled} previousId={session.lastCatch?.pokemon.id} registeredIds={registeredIds} onZone={onZone} />}
    {exploring ? <div className="safari-expedition"><div className="safari-field"><div className="safari-field-heading"><strong>{zone.routeName}</strong>{musicLink}<span className="safari-live">{WEATHER[weather].icon} {WEATHER[weather].name}</span></div>
      <SafariMap trainer={trainer} zone={zone} session={session} active={roaming && !busy} slideMs={slideMs} rustling={phase === "rustling"} weather={weather} date={today} onMove={onMove} onHoneyTree={onHoneyTree} />
      {hasIce(zone) && <p className="safari-ice-help">On slick ice, you slide straight ahead until you reach firm ground or an obstacle.</p>}
      <div className="safari-ranger-note"><span aria-hidden="true">{safe ? "↕" : "✦"}</span><p>{bag.repelSteps > 0 ? "Repel keeps walking encounters away. Open your Bag to check the remaining steps." : region ? safe ? "Walk through a marked exit to continue your journey. Open Region map to find your way." : regionalRoute(zone.id)?.kind === "cave" ? "Pokémon appear while walking through the cave. Follow marked exits to continue." : zone.encounterTerrain === "snow" ? "Search the snowdrifts for Pokémon. Follow marked exits to continue." : zone.encounterTerrain === "sand" ? "Search the rough sand for Pokémon. Follow marked exits to continue." : "Walk into tall grass to encounter Pokémon. Follow marked exits to reach the next town or route." : "Walk onto the sparkle for a guaranteed encounter. Talk to the ranger near the trailhead for a rare sighting. Open Route map to find both."}</p></div></div>
      {safe ? <RegionTown zoneId={zone.id} onPc={onPc} onPokedex={onPokedex} /> : <SafariFieldGuide shinyOdds={shinyOdds(bag, session.catches)} zone={zone} registeredIds={registeredIds} weather={weather} previousId={session.lastCatch?.pokemon.id} date={today} />}
    </div> : species && assignment && encounter && <section className={`safari-encounter is-${phase}${showQuery || phase === "caught" || phase === "fled" ? " has-sidebar" : ""}`} aria-labelledby="safari-wild-name">
      <SafariBattleScene trainer={trainer} ref={scene} key={encounter.id} species={species} zone={zone} phase={phase} encounter={encounter} registered={registeredIds.includes(species.id)} ballTheme={ballTheme}
        commands={{ busy, queryOpen: showQuery, onCatch: () => setQueryEncounterId(showQuery ? undefined : encounter.id), onLeave }} />
      {phase === "entering" || phase === "catching" ? null
        : phase === "fled" ? <SafariFledSummary name={visibleSafariPokemonId(encounter, phase) === undefined ? undefined : species.name} attempts={encounter.attempts} assignment={assignment} draft={session.draft} feedback={message} results={results} onLeave={onLeave} />
        : phase === "caught" ? <div className="safari-catch-summary" ref={caughtSummary} tabIndex={-1} role="region" aria-label="Caught Pokémon details"><SafariPokedexEntry pokemon={session.lastCatch!.pokemon} shiny={encounter.shiny} /><p>{message || `${species.name} is registered in your collection.`} Completed in {encounter.attempts} {encounter.attempts === 1 ? "query" : "queries"}.</p><div><button className="btn btn-primary" onClick={onLeave}>Keep exploring</button><button className="btn" onClick={onPokedex}>View Pokédex</button><button className="btn" onClick={onPc}>Open PC Boxes</button></div></div>
        : showQuery ? <div className="safari-assignment" ref={queryPanel}><div className="safari-assignment-heading"><div><span className="eyebrow">{assignment.topic}</span><h3>{assignment.title}</h3></div></div><p>{assignment.prompt}</p>
        <div className="safari-chances" data-urgent={remaining !== null && remaining <= 2} role="status">
          <strong>{remaining === null ? "Unlimited attempts" : `${remaining} ${remaining === 1 ? "chance" : "chances"} remaining`}</strong>
          {remaining !== null && <progress max={encounter.fleeAfter!} value={remaining} aria-label="Catch chances remaining" />}
          <span>{fieldwork ? "Run queries freely. Only an incorrect throw uses a chance." : remaining === null ? "Take your time. This Pokémon will stay while you practice." : `Flees after ${encounter.fleeAfter} incorrect answers. Hints, SQL errors and stopped queries keep your chances.`}</span>
        </div>
        <details><summary>Need a hint?</summary><p>{assignment.hint}</p></details>
        {editor(<div className="safari-query-actions">
          {busy ? <button className="btn btn-primary" onClick={onStop}>■ Stop catch query</button>
            : fieldwork && <button className="btn" disabled={!canSubmit} onClick={onPreview}>Preview SQL</button>}
          <span>{encounter.attempts} {fieldwork ? encounter.attempts === 1 ? "throw" : "throws" : encounter.attempts === 1 ? "checked query" : "checked queries"}</span>
          {!busy && <button className="btn btn-primary safari-catch-submit" disabled={!canSubmit} aria-label="Catch Pokémon" onClick={onSubmit}>Run query <kbd>Ctrl+Enter</kbd></button>}
        </div>)}
        {error && <p className="error-panel" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
        {results.length > 0 && <div className="safari-query-results"><h4>{fieldwork ? "Query results" : "Last checked query results"}</h4><QueryResults results={results} /></div>}
        <small>Your assignment uses the original Pokédex. Wrong answers and returning to the trail never add discoveries.</small>
      </div> : null}
    </section>}
    <details className="safari-credits"><summary>Safari art &amp; controls</summary><p>Route sections and field effects come from Pokémon Emerald. Red and Leaf's trainer sprites, battle terrain, window frames and pixel lettering come from Pokémon FireRed/LeafGreen, archived by the <a href="https://github.com/pret/pokefirered" target="_blank" rel="noreferrer">pret project</a>. Pokémon sprites come from PokéAPI. Palettes, route sections and walking collisions are adapted for PokéSQL, with its own camera, weather and SQL encounters. All assets are bundled locally. WASD and arrow keys work while exploring; open menus and typing pause walking, and reduced-motion preferences skip the battle animations.</p></details>
  </section>;
}
