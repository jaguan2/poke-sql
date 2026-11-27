import type { BagState } from "./bag-model";
import type { PokemonProfile } from "../../shared/pokemon/profile";
import type { Direction, Position, ZoneId } from "./zones";
import type { QueryResult } from "../../shared/sql/types";
import type { RegionId, RegionLocationId } from "./regions";

export type AssignmentId = "field-notes" | "stat-scan" | "type-tracker" | "ability-survey" | "tracking" | "ranger-survey";
export type SafariQueryMode = "preview" | "catch";
export type SafariFleeLimit = null | 5 | 8;
export interface SafariCatch { encounterId: string; pokemon: PokemonProfile; attempts: number; caughtAt: string }
export interface SafariEncounter {
  id: string; pokemonId: number; assignmentId: AssignmentId; attempts: number;
  outcome: "active" | "caught" | "fled"; fleeAfter: SafariFleeLimit;
  level?: number; // Absent in saves created before encounter levels.
  shiny?: boolean; // Older encounters default to their normal colors.
  source?: "honey-tree"; // Walking encounters omit the source, including old saves.
}
export interface SafariSession {
  version: 3; zoneId: ZoneId; position: Position; direction: Direction;
  steps: number; grassSteps: number; catches: number; encounter: SafariEncounter | null;
  draft: string; lastCatch: SafariCatch | null;
  layoutRevision?: number;
  bag?: BagState; // Additive item effects; older expeditions start without an active effect.
  retiredUnova?: unknown; // Original expedition archived when Unova world references are removed.
  visited?: ZoneId[]; // Additive save field; older Safari expeditions stay at their original habitat.
  regionPositions?: Partial<Record<RegionId, { zoneId: RegionLocationId; position: Position; direction: Direction; layoutRevision?: number }>>;
}
export type SafariPhase = "roaming" | "rustling" | "entering" | "battle" | "catching" | "caught" | "fled";
export interface SafariCaptureContext { id: string; level: number; shiny: boolean; zoneId: ZoneId; attempts: number; source?: SafariEncounter["source"] }
export interface SafariCheckReply { results?: QueryResult[]; passed?: boolean; safariPokemon?: PokemonProfile; safariFeedback?: string; error?: string; caughtAt?: string }
