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
export interface DbReply {
  schema: TableInfo[];
  challengeSchema?: TableInfo[];
  results?: QueryResult[];
  snapshot?: Uint8Array;
  error?: string;
  notice?: string;
  passed?: boolean;
  ms?: number;
}
export type DbRequest =
  | { action: "init"; original: Uint8Array; saved?: Uint8Array }
  | { action: "run"; sql: string }
  | { action: "check"; sql: string; challengeId: string }
  | { action: "reset" };
