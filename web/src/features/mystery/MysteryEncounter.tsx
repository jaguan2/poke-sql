import { useEffect, useRef } from "react";
import { EncounterScene } from "../../shared/ui/EncounterScene";
import { encounterLevel } from "../../shared/pokemon/encounter-level";
import type { MysteryRound } from "./model";
import type { TrainerId } from "../../shared/trainer/profile";

export function MysteryEncounter({ round, daily, trainer }: { round: MysteryRound; daily: boolean; trainer: TrainerId }) {
  const scene = useRef<HTMLDivElement>(null);
  const found = round.attempts.find(attempt => attempt.feedback.matched)?.feedback.pokemon;
  useEffect(() => {
    if (found) scene.current?.scrollIntoView({ block: "nearest" });
  }, [found]);
  return <div className={`mystery-encounter${found ? " is-revealed" : ""}`}>
    <EncounterScene ref={scene} label="Mystery Pokémon encounter" titleId="mystery-wild-name" terrain="grass"
      trainer={trainer}
      identity={{ name: found?.name ?? "???", level: round.level ?? encounterLevel(`mystery:${round.targetId}`), badge: found ? "FOUND" : daily ? "DAILY" : null }}
      pokemon={{ id: round.targetId, label: found ? `Revealed ${found.name}` : "Mystery Pokémon" }}
      caption={found ? <>It’s <span>{found.name}</span>!</> : round.guessCount > 0 ? "Still a mystery… Follow the clues!" : "A mysterious Pokémon appeared!"} />
  </div>;
}
