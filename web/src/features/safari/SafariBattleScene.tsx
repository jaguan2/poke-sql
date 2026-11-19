import { forwardRef } from "react";
import { EncounterScene } from "../../shared/ui/EncounterScene";
import { encounterLevel } from "../../shared/pokemon/encounter-level";
import type { SafariEncounter, SafariPhase } from "./types";
import type { SafariSpecies, SafariZoneDefinition } from "./zones";
import "./SafariBattleScene.css";

export const SafariBattleScene = forwardRef<HTMLDivElement, {
  species: SafariSpecies; zone: SafariZoneDefinition; phase: SafariPhase; encounter: SafariEncounter; registered: boolean;
}>(function SafariBattleScene({ species, zone, phase, encounter, registered }, ref) {
  const caught = phase === "caught";
  const fled = phase === "fled";
  const remaining = encounter.fleeAfter === null ? null : encounter.fleeAfter - encounter.attempts;
  const warning = encounter.attempts === 0 || remaining === null ? null : remaining === 1 ? "looks ready to flee!"
    : remaining <= Math.ceil(encounter.fleeAfter! / 2) ? "seems wary…" : "is watching carefully.";
  return <EncounterScene ref={ref} className={`safari-battle-scene safari-battle-${zone.encounterTerrain}`}
    label={`Wild ${species.name} encounter`} titleId="safari-wild-name" terrain={zone.battleTerrain}
    identity={{ name: species.name, level: encounter.level ?? encounterLevel(encounter.id), badge: caught ? "CAUGHT" : fled ? "FLED" : null, registered }}
    pokemon={{ id: species.id, label: `Wild ${species.name}` }}
    caption={phase === "entering" ? "The grass is stirring…" : caught
      ? <>Gotcha! <span>{species.name}</span> was caught!</> : fled ? <>Oh no! <span>{species.name}</span> fled!</>
        : warning ? <><span>{species.name}</span> {warning}</> : <>A wild <span>{species.name}</span> appeared!</>}>
    {phase === "entering" && <div className="safari-battle-wipe" aria-hidden="true"><span /><span /></div>}
    {caught && <img className="safari-catch-ball" src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} alt="" width={48} height={48} />}
  </EncounterScene>;
});
