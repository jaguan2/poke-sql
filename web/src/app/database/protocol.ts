import type { TableInfo, QueryResult } from "../../shared/sql/types";
import type { MysteryGuess } from "../../features/mystery/types";
import type { AchievementCatalog } from "../../features/pokedex/types";
import type { AssignmentId } from "../../features/safari/types";
import type { PokemonProfile } from "../../shared/pokemon/profile";

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
  safariPokemon?: PokemonProfile;
  safariFeedback?: string;
}
export type DbRequest =
  | { action: "init"; original: Uint8Array; saved?: Uint8Array }
  | { action: "run"; sql: string }
  | { action: "check"; sql: string; challengeId: string }
  | { action: "mystery-start"; previousId?: number }
  | { action: "mystery-query"; sql: string; targetId: number }
  | { action: "safari-check"; sql: string; pokemonId: number; assignmentId: AssignmentId }
  | { action: "reset" };
