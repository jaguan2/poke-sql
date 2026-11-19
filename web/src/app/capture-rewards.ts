import { readLocal } from "../shared/storage/local";
import { isMysteryRound, mysterySolved, recordMysteryGuess } from "../features/mystery/model";
import type { MysteryRound } from "../features/mystery/model";
import { DAILY_SCHEDULE_VERSION, isDailyMysteryRound } from "../features/mystery/daily";
import { loadSafariSession } from "../features/safari/persistence";
import { loadEncounters } from "../features/pokedex/persistence";
import { recordCollectionEncounters, recordSolvedEncounter, recordSafariEncounter } from "../features/pokedex/encounters";
import type { PokemonEncounter } from "../features/pokedex/encounters";
import type { CapturedPokemon, Collection, LegacyImport } from "../features/pc/types";

export const randomRewardId = (round: MysteryRound) => `random:${round.id ?? `legacy-${round.targetId}`}`;
export const dailyRewardId = (date: string, version = DAILY_SCHEDULE_VERSION) => `daily:${version}:${date}`;
export function restoreRandomRound(): MysteryRound | null {
  const round = readLocal("mystery-round", null, isMysteryRound);
  return round && !round.id ? { ...round, id: `legacy-${round.targetId}` } : round;
}

export function readLegacyCollection(): LegacyImport {
  const backup: Record<string, string | null> = {};
  try {
    for (const key of ["encounters", "safari", "mystery-round", "daily-mystery-round"])
      backup[key] = localStorage.getItem(`pokesql:${key}`);
  } catch { return { discoveries: [], consumedIds: [], backup: null }; }
  const daily = readLocal("daily-mystery-round", null, isDailyMysteryRound);
  const random = readLocal("mystery-round", null, isMysteryRound);
  const safari = loadSafariSession();
  const entries = recordSafariEncounter(recordSolvedEncounter(recordSolvedEncounter(loadEncounters().entries, daily, "daily"), random, "random"), safari.lastCatch);
  const consumedIds: string[] = [];
  if (daily && mysterySolved(daily)) consumedIds.push(dailyRewardId(daily.date, daily.scheduleVersion));
  if (random && mysterySolved(random)) consumedIds.push(randomRewardId(random));
  if (safari.lastCatch) consumedIds.push(`safari:${safari.lastCatch.encounterId}`);
  return { backup, consumedIds, discoveries: entries.map(entry => ({
    id: `legacy:${entry.pokemon.id}`, pokemon: entry.pokemon, source: "legacy", sources: [...entry.sources],
    firstRecordedAt: entry.firstFoundAt, caughtAt: null, level: null, ball: null, location: null,
    attempts: entry.bestGuessCount, sql: null,
  })) };
}

export function collectionDiscoveries(collection: Collection | null): PokemonEncounter[] {
  return recordCollectionEncounters([], collection?.captures.map(capture => ({ pokemon: capture.pokemon, firstFoundAt: capture.firstRecordedAt,
    bestGuessCount: capture.attempts, sources: [...capture.sources] })) ?? []);
}

// A committed capture can restore an interrupted game-save update without SQL replay.
export function restoreSolvedRound<T extends MysteryRound>(round: T, capture: CapturedPokemon | undefined): T {
  if (!capture || capture.pokemon.id !== round.targetId || mysterySolved(round)) return round;
  const solved = recordMysteryGuess(round, capture.sql ?? "", { pokemon: capture.pokemon, matched: true,
    type1: "correct", type2: "correct", generation: "correct", height: "correct", weight: "correct" });
  return { ...round, ...solved, guessCount: capture.attempts };
}
