import { forwardRef } from "react";
import assets from "./assets.json";
import type { SafariEncounter, SafariPhase } from "./types";
import type { SafariSpecies, SafariZoneDefinition } from "./zones";
import "./SafariBattleScene.css";

type SpriteBounds = typeof assets.spriteBounds["1"];
const spriteBounds: Readonly<Record<string, SpriteBounds>> = assets.spriteBounds;

export const SafariBattleScene = forwardRef<HTMLDivElement, {
  species: SafariSpecies; zone: SafariZoneDefinition; phase: SafariPhase; encounter: SafariEncounter;
}>(function SafariBattleScene({ species, zone, phase, encounter }, ref) {
  const bounds = spriteBounds[species.id];
  // Position visible pixels, not the transparent 96px PokéAPI canvas. Native
  // small Pokémon stay small; large Pokémon fit a 64x64 game-pixel envelope.
  const scale = Math.min(1, 64 / bounds.width, 64 / bounds.height);
  const caught = phase === "caught";
  const fled = phase === "fled";
  const remaining = encounter.fleeAfter === null ? null : encounter.fleeAfter - encounter.attempts;
  const warning = encounter.attempts === 0 || remaining === null ? null : remaining === 1 ? "looks ready to flee!"
    : remaining <= Math.ceil(encounter.fleeAfter! / 2) ? "seems wary…" : "is watching carefully.";
  return <div className={`safari-battle-scene safari-battle-${zone.encounterTerrain}`} ref={ref} aria-label={`Wild ${species.name} encounter`}>
    <img className="safari-battle-background" src={`${import.meta.env.BASE_URL}safari/battle/${zone.battleTerrain}.png`} alt="" width={240} height={160} />
    <div className="safari-wild-card">
      <h3 id="safari-wild-name">{species.name}</h3>
      <small>No.{String(species.id).padStart(4, "0")}</small>
      <span>{caught ? "CAUGHT" : fled ? "FLED" : "WILD"}</span><i aria-hidden="true" />
    </div>
    <span className="safari-wild-sprite" role="img" aria-label={`Wild ${species.name}`} style={{ width: `${bounds.width * scale / 240 * 100}%`, height: `${bounds.height * scale / 160 * 100}%` }}>
      <img src={`${import.meta.env.BASE_URL}sprites/${species.id}.png`} alt="" width={bounds.canvasWidth} height={bounds.canvasHeight}
        style={{ width: `${bounds.canvasWidth / bounds.width * 100}%`, height: `${bounds.canvasHeight / bounds.height * 100}%`, left: `${-bounds.left / bounds.width * 100}%`, top: `${-bounds.top / bounds.height * 100}%` }} />
    </span>
    <span className="safari-battle-trainer" aria-hidden="true" />
    <div className="safari-encounter-caption" role="status"><span>{phase === "entering" ? "The grass is stirring…" : caught
      ? <>Gotcha! <span>{species.name}</span> was caught!</> : fled ? <>Oh no! <span>{species.name}</span> fled!</>
        : warning ? <><span>{species.name}</span> {warning}</> : <>A wild <span>{species.name}</span> appeared!</>}</span></div>
    {phase === "entering" && <div className="safari-battle-wipe" aria-hidden="true"><span /><span /></div>}
    {caught && <img className="safari-catch-ball" src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} alt="" width={48} height={48} />}
  </div>;
});
