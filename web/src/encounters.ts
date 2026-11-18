import { isMysteryPokemon } from "./mystery";
import type { MysteryRound } from "./mystery";
import type { MysteryPokemon } from "./types";

export const POKEDEX_SPECIES_COUNT = 1025;
export type EncounterSource = "daily" | "random";

export interface PokemonEncounter {
  pokemon: MysteryPokemon;
  firstFoundAt: string;
  bestGuessCount: number;
  sources: EncounterSource[];
}

export function isPokemonEncounters(value: unknown): value is PokemonEncounter[] {
  if (!Array.isArray(value) || value.length > POKEDEX_SPECIES_COUNT) return false;
  const ids = new Set<number>();
  return value.every(entry => {
    if (!entry || typeof entry !== "object" || !isMysteryPokemon(entry.pokemon)
      || entry.pokemon.id > POKEDEX_SPECIES_COUNT || entry.pokemon.generationId > 9
      || ids.has(entry.pokemon.id) || !Number.isSafeInteger(entry.bestGuessCount) || entry.bestGuessCount < 1
      || typeof entry.firstFoundAt !== "string" || !Number.isFinite(Date.parse(entry.firstFoundAt))
      || new Date(entry.firstFoundAt).toISOString() !== entry.firstFoundAt
      || !Array.isArray(entry.sources) || entry.sources.length < 1 || entry.sources.length > 2
      || new Set(entry.sources).size !== entry.sources.length
      || !entry.sources.every((source: unknown) => source === "daily" || source === "random")) return false;
    ids.add(entry.pokemon.id);
    return true;
  });
}

// Only the solved target is a discovery. Research results and intermediate
// guesses never enter the collection. Re-reading a saved win is idempotent.
export function recordSolvedEncounter(encounters: PokemonEncounter[], round: MysteryRound | null, source: EncounterSource, now = new Date()): PokemonEncounter[] {
  const found = round?.attempts.find(attempt => attempt.feedback.matched && attempt.feedback.pokemon.id === round.targetId);
  if (!round || round.guessCount < 1 || !found || found.feedback.pokemon.id > POKEDEX_SPECIES_COUNT || found.feedback.pokemon.generationId > 9) return encounters;
  const existing = encounters.find(entry => entry.pokemon.id === round.targetId);
  if (!existing) return [...encounters, {
    pokemon: found.feedback.pokemon,
    firstFoundAt: now.toISOString(),
    bestGuessCount: round.guessCount,
    sources: [source],
  }];
  const bestGuessCount = Math.min(existing.bestGuessCount, round.guessCount);
  if (existing.sources.includes(source) && existing.bestGuessCount === bestGuessCount) return encounters;
  return encounters.map(entry => entry !== existing ? entry : {
    ...entry, bestGuessCount,
    sources: existing.sources.includes(source) ? existing.sources : [...existing.sources, source],
  });
}
