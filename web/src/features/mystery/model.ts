import type { Database } from "sql.js";
import { runStatements } from "../../shared/sql/engine";
import type { QueryResult } from "../../shared/sql/types";
import { isPokemonProfile } from "../../shared/pokemon/profile";
import type { MysteryGuess, NumberClue, TypeClue } from "./types";
import type { PokemonProfile } from "../../shared/pokemon/profile";

export const MYSTERY_INITIAL_QUERY = "-- Return one Pokémon to make a guess.\nSELECT * FROM pokedex\nWHERE name = 'Pikachu';";
export const MYSTERY_HISTORY_LIMIT = 30;
export interface MysteryRound {
  targetId: number;
  guessCount: number;
  attempts: { sql: string; feedback: MysteryGuess }[];
}

export function pickMysteryTarget(db: Database, previousId = 0): number {
  const id = db.exec("SELECT id FROM pokemon WHERE id != ? ORDER BY RANDOM() LIMIT 1", [previousId])[0]?.values[0]?.[0];
  if (typeof id !== "number") throw new Error("Could not choose a hidden Pokémon. Start a new mystery.");
  return id;
}

function readPokemon(db: Database, identity: number | string): PokemonProfile | undefined {
  const row = db.exec(`SELECT id, name, type1, type2, generation_id, height_m, weight_kg
    FROM pokedex WHERE ${typeof identity === "number" ? "id = ?" : "name = ? COLLATE NOCASE"}`, [identity])[0]?.values[0];
  if (!row) return undefined;
  return {
    id: Number(row[0]), name: String(row[1]), type1: String(row[2]), type2: row[3] === null ? null : String(row[3]),
    generationId: Number(row[4]), heightM: Number(row[5]), weightKg: Number(row[6]),
  };
}

export function compareMysteryPokemon(guess: PokemonProfile, target: PokemonProfile): MysteryGuess {
  const typeClue = (value: string | null, exact: string | null, other: string | null): TypeClue =>
    value === exact ? "correct" : value !== null && value === other ? "partial" : "wrong";
  const numberClue = (value: number, expected: number): NumberClue => value === expected ? "correct" : value < expected ? "higher" : "lower";
  return {
    pokemon: guess, matched: guess.id === target.id,
    type1: typeClue(guess.type1, target.type1, target.type2),
    type2: typeClue(guess.type2, target.type2, target.type1),
    generation: numberClue(guess.generationId, target.generationId),
    height: numberClue(guess.heightM, target.heightM), weight: numberClue(guess.weightKg, target.weightKg),
  };
}

// The caller supplies an isolated original database with query_only enabled.
// Research queries still return normal results; only a single identifiable
// Pokémon becomes a guess. Clues always use original traits, not SQL aliases
// or fabricated values projected by the user's query.
export function runMysteryQuery(db: Database, sql: string, targetId: number): { results: QueryResult[]; mysteryGuess?: MysteryGuess; notice?: string } {
  const target = readPokemon(db, targetId);
  if (!target) throw new Error("This mystery could not be restored. Choose New Pokémon to start again.");
  const results = runStatements(db, sql, true);
  const result = results[0];
  if (!result || result.truncated || result.values.length !== 1) {
    return { results, notice: "Research query only — return exactly one Pokémon, including its id or name, to make a guess." };
  }
  const identityColumns = (name: string) => result.columns.flatMap((column, index) => column.toLowerCase() === name ? [index] : []);
  const ids = identityColumns("id");
  const names = identityColumns("name");
  let identity: number | string | undefined;
  if (ids.length === 1) {
    const id = result.values[0][ids[0]];
    if (isPositiveInteger(id)) identity = id;
  } else if (ids.length === 0 && names.length === 1) {
    const name = result.values[0][names[0]];
    if (typeof name === "string") identity = name;
  }
  const guess = identity === undefined ? undefined : readPokemon(db, identity);
  if (!guess) return { results, notice: "Research query only — include one unambiguous id or name column identifying a Pokémon to make a guess." };
  return { results, mysteryGuess: compareMysteryPokemon(guess, target) };
}

export const mysterySolved = (round: MysteryRound | null): boolean => round?.attempts.some(attempt => attempt.feedback.matched) ?? false;

export function recordMysteryGuess(round: MysteryRound, sql: string, feedback: MysteryGuess): MysteryRound {
  if (mysterySolved(round)) return round;
  return { ...round, guessCount: round.guessCount + 1, attempts: [...round.attempts, { sql, feedback }].slice(-MYSTERY_HISTORY_LIMIT) };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

// localStorage is untrusted input. Reject malformed rounds before rendering
// their nested clues, while keeping the rest of the workspace usable.
export function isMysteryRound(value: unknown): value is MysteryRound | null {
  if (value === null) return true;
  if (!isRecord(value) || !isPositiveInteger(value.targetId) || !Number.isSafeInteger(value.guessCount) || Number(value.guessCount) < 0
    || !Array.isArray(value.attempts) || value.attempts.length > MYSTERY_HISTORY_LIMIT || value.attempts.length > Number(value.guessCount)) return false;
  return value.attempts.every(attempt => {
    if (!isRecord(attempt) || typeof attempt.sql !== "string" || attempt.sql.length > 100_000 || !isRecord(attempt.feedback)) return false;
    const feedback = attempt.feedback;
    const pokemon = feedback.pokemon;
    return isPokemonProfile(pokemon) && typeof feedback.matched === "boolean"
      && [feedback.type1, feedback.type2].every(clue => clue === "correct" || clue === "partial" || clue === "wrong")
      && [feedback.generation, feedback.height, feedback.weight].every(clue => clue === "correct" || clue === "higher" || clue === "lower");
  });
}
