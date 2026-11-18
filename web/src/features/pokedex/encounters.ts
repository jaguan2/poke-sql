import { isPokemonProfile } from "../../shared/pokemon/profile";
import type { MysteryRound } from "../mystery/model";
import type { PokemonProfile } from "../../shared/pokemon/profile";
import type { SafariCatch } from "../safari/types";

export const POKEDEX_SPECIES_COUNT = 1025;
export type EncounterSource = "daily" | "random" | "safari";

export interface PokemonEncounter {
  pokemon: PokemonProfile;
  firstFoundAt: string;
  bestGuessCount: number;
  sources: EncounterSource[];
}

export function isPokemonEncounters(value: unknown): value is PokemonEncounter[] {
  if (!Array.isArray(value) || value.length > POKEDEX_SPECIES_COUNT) return false;
  const ids = new Set<number>();
  return value.every(entry => {
    if (!entry || typeof entry !== "object" || !isPokemonProfile(entry.pokemon)
      || entry.pokemon.id > POKEDEX_SPECIES_COUNT || entry.pokemon.generationId > 9
      || ids.has(entry.pokemon.id) || !Number.isSafeInteger(entry.bestGuessCount) || entry.bestGuessCount < 1
      || typeof entry.firstFoundAt !== "string" || !Number.isFinite(Date.parse(entry.firstFoundAt))
      || new Date(entry.firstFoundAt).toISOString() !== entry.firstFoundAt
      || !Array.isArray(entry.sources) || entry.sources.length < 1 || entry.sources.length > 3
      || new Set(entry.sources).size !== entry.sources.length
      || !entry.sources.every((source: unknown) => source === "daily" || source === "random" || source === "safari")) return false;
    ids.add(entry.pokemon.id);
    return true;
  });
}

// Only the solved target is a discovery. Research results and intermediate
// guesses never enter the collection. Re-reading a saved win is idempotent.
export function recordSolvedEncounter(encounters: PokemonEncounter[], round: MysteryRound | null, source: EncounterSource, now = new Date()): PokemonEncounter[] {
  const found = round?.attempts.find(attempt => attempt.feedback.matched && attempt.feedback.pokemon.id === round.targetId);
  if (!round || round.guessCount < 1 || !found || found.feedback.pokemon.id > POKEDEX_SPECIES_COUNT || found.feedback.pokemon.generationId > 9) return encounters;
  return recordDiscovery(encounters, found.feedback.pokemon, round.guessCount, source, now.toISOString());
}

export function recordSafariEncounter(encounters: PokemonEncounter[], caught: SafariCatch | null): PokemonEncounter[] {
  if (!caught || !isPokemonProfile(caught.pokemon) || caught.pokemon.id > POKEDEX_SPECIES_COUNT || caught.pokemon.generationId > 9
    || !Number.isSafeInteger(caught.attempts) || caught.attempts < 1
    || typeof caught.caughtAt !== "string" || !Number.isFinite(Date.parse(caught.caughtAt))
    || new Date(caught.caughtAt).toISOString() !== caught.caughtAt) return encounters;
  return recordDiscovery(encounters, caught.pokemon, caught.attempts, "safari", caught.caughtAt);
}

function recordDiscovery(encounters: PokemonEncounter[], pokemon: PokemonProfile, attempts: number, source: EncounterSource, at: string): PokemonEncounter[] {
  const existing = encounters.find(entry => entry.pokemon.id === pokemon.id);
  if (!existing) return [...encounters, {
    pokemon,
    firstFoundAt: at,
    bestGuessCount: attempts,
    sources: [source],
  }];
  const bestGuessCount = Math.min(existing.bestGuessCount, attempts);
  if (existing.sources.includes(source) && existing.bestGuessCount === bestGuessCount) return encounters;
  return encounters.map(entry => entry !== existing ? entry : {
    ...entry, bestGuessCount,
    sources: existing.sources.includes(source) ? existing.sources : [...existing.sources, source],
  });
}
