import { forwardRef, useRef } from "react";
import { EncounterScene } from "../../shared/ui/EncounterScene";
import { encounterLevel } from "../../shared/pokemon/encounter-level";
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
  const remaining = encounter.fleeAfter === null ? null : encounter.fleeAfter - encounter.attempts;
  const warning = encounter.attempts === 0 || remaining === null ? null : remaining === 1 ? "looks ready to flee!"
    : remaining <= Math.ceil(encounter.fleeAfter! / 2) ? "seems wary…" : "is watching carefully.";
  return <EncounterScene ref={ref} className={`safari-battle-scene safari-battle-${zone.encounterTerrain}`}
    label={`Wild ${species.name} encounter`} titleId="safari-wild-name" terrain={zone.battleTerrain}
    identity={{ name: species.name, level: encounter.level ?? encounterLevel(encounter.id), badge: caught ? "CAUGHT" : fled ? "FLED" : null, registered: caught || previouslyRegistered }}
    pokemon={{ id: species.id, label: `Wild ${species.name}` }}
    trainer={trainer} throwing={catching}
    caption={phase === "entering" ? "The grass is stirring…" : catching ? "Nice query! Making the catch…" : caught
      ? <>Gotcha! <span>{species.name}</span> was caught!</> : fled ? <>Oh no! <span>{species.name}</span> fled!</>
        : warning ? <><span>{species.name}</span> {warning}</> : <>A wild <span>{species.name}</span> appeared!</>}>
    {phase === "entering" && <div className="safari-battle-wipe" aria-hidden="true"><span /><span /></div>}
    {(catching || caught) && <img className="safari-catch-ball" src={`${import.meta.env.BASE_URL}sprites/items/${ballTheme}.png`} alt="" width={30} height={30} />}
    {catching && <span className="safari-catch-flash" aria-hidden="true" />}
  </EncounterScene>;
});
