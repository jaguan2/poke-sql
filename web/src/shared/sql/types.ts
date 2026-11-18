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
