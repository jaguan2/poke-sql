import type { PokemonProfile } from "../../shared/pokemon/profile";
import type { Direction, Position, ZoneId } from "./zones";
import type { QueryResult } from "../../shared/sql/types";

export type AssignmentId = "field-notes" | "stat-scan" | "type-tracker" | "ability-survey";
export interface SafariCatch { encounterId: string; pokemon: PokemonProfile; attempts: number; caughtAt: string }
export interface SafariEncounter { id: string; pokemonId: number; assignmentId: AssignmentId; attempts: number; caught: boolean }
export interface SafariSession {
  version: 2; zoneId: ZoneId; position: Position; direction: Direction;
  steps: number; grassSteps: number; catches: number; encounter: SafariEncounter | null;
  draft: string; lastCatch: SafariCatch | null;
}
export type SafariPhase = "roaming" | "rustling" | "entering" | "battle" | "caught";
export interface SafariCheckReply { results?: QueryResult[]; passed?: boolean; safariPokemon?: PokemonProfile; error?: string }
