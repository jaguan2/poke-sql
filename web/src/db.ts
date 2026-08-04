import initSqlJs from "sql.js";
import type { Database, QueryExecResult } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export interface TableInfo {
  name: string;
  kind: "table" | "view";
  columns: { name: string; type: string; pk: boolean }[];
}

let db: Database | null = null;
let originalBytes: Uint8Array | null = null;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const res = await fetch(`${import.meta.env.BASE_URL}pokemon.sqlite`);
  if (!res.ok) throw new Error(`Failed to fetch database: ${res.status}`);
  const buf = await res.arrayBuffer();
  originalBytes = new Uint8Array(buf);
  db = new SQL.Database(originalBytes);
}

function requireDb(): Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function runQuery(sql: string): QueryExecResult[] {
  return requireDb().exec(sql);
}

/** Restore the database to its freshly-built state (undoes any INSERT/UPDATE/DROP practice). */
export async function resetDb(): Promise<void> {
  if (!originalBytes) throw new Error("Database not initialized");
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
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
