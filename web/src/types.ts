import type { SqlValue } from "sql.js";

export const MAX_RESULT_ROWS = 2000;
export interface QueryResult {
  columns: string[];
  values: SqlValue[][];
  truncated: boolean;
}
export interface TableInfo {
  name: string;
  kind: "table" | "view";
  columns: { name: string; type: string; pk: boolean }[];
}
export interface MysteryPokemon {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  generationId: number;
  heightM: number;
  weightKg: number;
}
export type TypeClue = "correct" | "partial" | "wrong";
export type NumberClue = "correct" | "higher" | "lower";
export interface MysteryGuess {
  pokemon: MysteryPokemon;
  matched: boolean;
  type1: TypeClue;
  type2: TypeClue;
  generation: NumberClue;
  height: NumberClue;
  weight: NumberClue;
}
export interface AchievementCatalog {
  speciesCount: number;
  generations: { id: number; name: string; region: string; total: number }[];
  types: { name: string; total: number }[];
}
export interface DbReply {
  schema: TableInfo[];
  challengeSchema?: TableInfo[];
  results?: QueryResult[];
  snapshot?: Uint8Array;
  error?: string;
  notice?: string;
  passed?: boolean;
  ms?: number;
  mysteryTargetId?: number;
  mysteryGuess?: MysteryGuess;
  achievementCatalog?: AchievementCatalog;
  datasetUpdateAvailable?: boolean;
}
export type DbRequest =
  | { action: "init"; original: Uint8Array; saved?: Uint8Array }
  | { action: "run"; sql: string }
  | { action: "check"; sql: string; challengeId: string }
  | { action: "mystery-start"; previousId?: number }
  | { action: "mystery-query"; sql: string; targetId: number }
  | { action: "reset" };
