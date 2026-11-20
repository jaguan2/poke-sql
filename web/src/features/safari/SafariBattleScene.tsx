import { forwardRef, useRef } from "react";
import { EncounterScene } from "../../shared/ui/EncounterScene";
import { legacyEncounterLevel } from "../../shared/pokemon/encounter-level";
import type { SafariEncounter, SafariPhase } from "./types";
import type { SafariSpecies, SafariZoneDefinition } from "./zones";
import type { TrainerId } from "../../shared/trainer/profile";
import "./SafariBattleScene.css";

export const SafariBattleScene = forwardRef<HTMLDivElement, {
  species: SafariSpecies; zone: SafariZoneDefinition; phase: SafariPhase; encounter: SafariEncounter; registered: boolean; ballTheme: string; trainer: TrainerId;
}>(function SafariBattleScene({ species, zone, phase, encounter, registered, ballTheme, trainer }, ref) {
  const catching = phase === "catching";
  const caught = phase === "caught";
  // The journal records success immediately; keep the old marker until the reveal.
  const previouslyRegistered = useRef(registered).current;
  const fled = phase === "fled";
  const hidden = encounter.assignmentId === "tracking" && !caught;
  const name = hidden ? "The wild Pokémon" : species.name;
  const remaining = encounter.fleeAfter === null ? null : encounter.fleeAfter - encounter.attempts;
  const warning = encounter.attempts === 0 || remaining === null ? null : remaining === 1 ? "looks ready to flee!"
    : remaining <= Math.ceil(encounter.fleeAfter! / 2) ? "seems wary…" : "is watching carefully.";
  return <EncounterScene ref={ref} className={`safari-battle-scene safari-battle-${zone.encounterTerrain}`}
    label={hidden ? "Wild Pokémon encounter" : `Wild ${species.name} encounter`} titleId="safari-wild-name" terrain={zone.battleTerrain}
    identity={{ name: hidden ? "???" : species.name, level: encounter.level ?? legacyEncounterLevel(encounter.id), badge: caught ? "CAUGHT" : fled ? "FLED" : null, registered: !hidden && (caught || previouslyRegistered) }}
    pokemon={hidden ? null : { id: species.id, label: `Wild ${species.name}`, shiny: encounter.shiny }}
    trainer={trainer} throwing={catching}
    caption={phase === "entering" ? "The grass is stirring…" : catching ? "Nice query! Making the catch…" : caught
      ? <>Gotcha! <span>{name}</span> was caught!</> : fled ? <>Oh no! <span>{name}</span> fled!</>
        : warning ? <><span>{name}</span> {warning}</> : hidden ? "Something is hiding in the grass." : <>A wild <span>{name}</span> appeared!</>}>
    {phase === "entering" && <div className="safari-battle-wipe" aria-hidden="true"><span /><span /></div>}
    {encounter.shiny && <span className="safari-shiny-badge"><span aria-hidden="true">✦</span> Shiny</span>}
    {(catching || caught) && <img className="safari-catch-ball" src={`${import.meta.env.BASE_URL}sprites/items/${ballTheme}.png`} alt="" width={30} height={30} />}
    {catching && <span className="safari-catch-flash" aria-hidden="true" />}
  </EncounterScene>;
});
