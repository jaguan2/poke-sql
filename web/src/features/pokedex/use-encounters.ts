import { useEffect, useState } from "react";
import type { MysteryRound } from "../mystery/model";
import { recordCollectionEncounters, recordSafariEncounter, recordSolvedEncounter } from "./encounters";
import type { PokemonEncounter } from "./encounters";
import { writeLocal } from "../../shared/storage/local";
import { loadEncounters } from "./persistence";
import type { SafariCatch } from "../safari/types";

function collectSolvedRounds(previous: PokemonEncounter[], dailyRound: MysteryRound | null, randomRound: MysteryRound | null, safariCatch: SafariCatch | null) {
  const now = new Date();
  return recordSafariEncounter(recordSolvedEncounter(recordSolvedEncounter(previous, dailyRound, "daily", now), randomRound, "random", now), safariCatch);
}

export function useEncounters(dailyRound: MysteryRound | null, randomRound: MysteryRound | null, safariCatch: SafariCatch | null = null, discoveries?: PokemonEncounter[]) {
  const [loaded] = useState(loadEncounters);
  const [encounters, setEncounters] = useState(() => collectSolvedRounds(loaded.entries, dailyRound, randomRound, safariCatch));
  const [saveError, setSaveError] = useState(!loaded.canSave);
  useEffect(() => {
    // Includes the latest saved solved rounds when upgrading an existing
    // workspace. This does not replay SQL or inspect the mutable practice DB.
    setEncounters(previous => recordCollectionEncounters(collectSolvedRounds(previous, dailyRound, randomRound, safariCatch), discoveries ?? []));
  }, [dailyRound, randomRound, safariCatch, discoveries]);
  useEffect(() => {
    if (loaded.canSave && !writeLocal("encounters", encounters)) setSaveError(true);
  }, [encounters, loaded.canSave]);
  return { encounters, saveError, recovered: loaded.recovered };
}
