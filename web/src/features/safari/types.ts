import type { PokemonProfile } from "../../shared/pokemon/profile";
import type { Direction, Position, ZoneId } from "./zones";
import type { QueryResult } from "../../shared/sql/types";

export type AssignmentId = "field-notes" | "stat-scan" | "type-tracker" | "ability-survey" | "tracking" | "ranger-survey";
export type SafariQueryMode = "preview" | "catch";
export type SafariFleeLimit = null | 5 | 8;
export interface SafariCatch { encounterId: string; pokemon: PokemonProfile; attempts: number; caughtAt: string }
export interface SafariEncounter {
  id: string; pokemonId: number; assignmentId: AssignmentId; attempts: number;
  outcome: "active" | "caught" | "fled"; fleeAfter: SafariFleeLimit;
  level?: number; // Absent in saves created before encounter levels.
  shiny?: boolean; // Older encounters default to their normal colors.
}
export interface SafariSession {
  version: 3; zoneId: ZoneId; position: Position; direction: Direction;
  steps: number; grassSteps: number; catches: number; encounter: SafariEncounter | null;
  draft: string; lastCatch: SafariCatch | null;
}
export type SafariPhase = "roaming" | "rustling" | "entering" | "battle" | "catching" | "caught" | "fled";
export interface SafariCaptureContext { id: string; level: number; shiny: boolean; zoneId: ZoneId; attempts: number }
export interface SafariCheckReply { results?: QueryResult[]; passed?: boolean; safariPokemon?: PokemonProfile; safariFeedback?: string; error?: string; caughtAt?: string }
