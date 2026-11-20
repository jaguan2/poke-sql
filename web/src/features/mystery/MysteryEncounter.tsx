import { useEffect, useRef, useState } from "react";
import { EncounterScene } from "../../shared/ui/EncounterScene";
import { legacyEncounterLevel } from "../../shared/pokemon/encounter-level";
import type { MysteryRound } from "./model";
import type { TrainerId } from "../../shared/trainer/profile";
import { CAPTURE_DURATION_MS } from "../../shared/ui/encounter-capture";

export function MysteryEncounter({ round, daily, trainer, ballTheme }: { round: MysteryRound; daily: boolean; trainer: TrainerId; ballTheme: string }) {
  const scene = useRef<HTMLDivElement>(null);
  const found = round.attempts.find(attempt => attempt.feedback.matched)?.feedback.pokemon;
  const solved = !!found;
  // Restored wins are settled; only a newly solved round plays the throw.
  const [finished, setFinished] = useState(solved);
  const phase = solved ? finished ? "caught" : "catching" : null;
  useEffect(() => {
    if (!solved || finished) return;
    const timer = setTimeout(() => setFinished(true), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : CAPTURE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [solved, finished]);
  useEffect(() => {
    if (solved) scene.current?.scrollIntoView({ block: "nearest" });
  }, [solved]);
  return <div className="mystery-encounter">
    <EncounterScene ref={scene} label="Mystery Pokémon encounter" titleId="mystery-wild-name" terrain="grass"
      trainer={trainer} capture={phase ? { phase, ball: ballTheme } : undefined}
      identity={{ name: found?.name ?? "???", level: round.level ?? legacyEncounterLevel(`mystery:${round.targetId}`), badge: phase === "caught" ? "CAUGHT" : found ? null : daily ? "DAILY" : null, registered: phase === "caught" }}
      pokemon={{ id: round.targetId, label: found ? `Revealed ${found.name}` : "Mystery Pokémon" }}
      caption={phase === "catching" ? "Throwing a Poké Ball…" : found ? <>Gotcha! <span>{found.name}</span> was caught!</> : round.guessCount > 0 ? "Still a mystery… Follow the clues!" : "A mysterious Pokémon appeared!"} />
  </div>;
}
