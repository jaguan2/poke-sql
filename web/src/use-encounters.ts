import { useEffect, useState } from "react";
import type { MysteryRound } from "./mystery";
import { isPokemonEncounters, recordSolvedEncounter } from "./encounters";
import type { PokemonEncounter } from "./encounters";
import { readLocal, writeLocal } from "./storage";

function collectSolvedRounds(previous: PokemonEncounter[], dailyRound: MysteryRound | null, randomRound: MysteryRound | null) {
  const now = new Date();
  return recordSolvedEncounter(recordSolvedEncounter(previous, dailyRound, "daily", now), randomRound, "random", now);
}

export function useEncounters(dailyRound: MysteryRound | null, randomRound: MysteryRound | null) {
  const [encounters, setEncounters] = useState(() => collectSolvedRounds(readLocal("encounters", [], isPokemonEncounters), dailyRound, randomRound));
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    // Includes the latest saved solved rounds when upgrading an existing
    // workspace. This does not replay SQL or inspect the mutable practice DB.
    setEncounters(previous => collectSolvedRounds(previous, dailyRound, randomRound));
  }, [dailyRound, randomRound]);
  useEffect(() => {
    if (!writeLocal("encounters", encounters)) setSaveError(true);
  }, [encounters]);
  return { encounters, saveError };
}
