import initSqlJs from "sql.js";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

/** Rows materialized per statement before the query is cut off. Protects the
 *  UI thread from accidental cartesian products (pokemon × pokemon ≈ 1M rows). */
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

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let originalBytes: Uint8Array | null = null;
let initPromise: Promise<void> | null = null;

/** Idempotent: concurrent/repeat calls (React StrictMode double-mount) share
 *  one fetch and one Database instance. */
export function initDb(): Promise<void> {
  initPromise ??= (async () => {
    SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const res = await fetch(`${import.meta.env.BASE_URL}pokemon.sqlite`);
    if (!res.ok) throw new Error(`Failed to fetch database: ${res.status}`);
    originalBytes = new Uint8Array(await res.arrayBuffer());
    db = new SQL.Database(originalBytes);
  })();
  return initPromise;
}

function requireDb(): Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

/** Execute one or more statements. Unlike db.exec, this stops materializing
 *  rows at MAX_RESULT_ROWS per statement (marking the result truncated), and
 *  zero-row SELECTs still report their column headers. */
export function runQuery(sql: string): QueryResult[] {
  const d = requireDb();
  const results: QueryResult[] = [];
  for (const stmt of d.iterateStatements(sql)) {
    const columns = stmt.getColumnNames();
    const values: SqlValue[][] = [];
    let truncated = false;
    while (stmt.step()) {
      if (values.length >= MAX_RESULT_ROWS) {
        truncated = true;
        break;
      }
      values.push(stmt.get());
    }
    if (columns.length > 0) results.push({ columns, values, truncated });
  }
  return results;
}

/** Restore the database to its freshly-built state (undoes any INSERT/UPDATE/DROP practice). */
export function resetDb(): void {
  if (!SQL || !originalBytes) throw new Error("Database not initialized");
  db?.close();
  db = new SQL.Database(originalBytes);
}

export function getSchema(): TableInfo[] {
  const d = requireDb();
  const tables = d.exec(
    `SELECT name, type FROM sqlite_master
     WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name`
  );
  if (tables.length === 0) return [];
  return tables[0].values.map(([name, type]) => {
    const info = d.exec(`PRAGMA table_info("${name}")`);
    const columns = (info[0]?.values ?? []).map((row) => ({
      name: String(row[1]),
      type: String(row[2] ?? ""),
      pk: Number(row[5]) > 0,
    }));
    return { name: String(name), kind: type as "table" | "view", columns };
  });
}

/** Column map for CodeMirror's SQL autocomplete. */
export function schemaForAutocomplete(schema: TableInfo[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const t of schema) map[t.name] = t.columns.map((c) => c.name);
  return map;
}
