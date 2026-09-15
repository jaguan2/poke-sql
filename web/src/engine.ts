import type { Database } from "sql.js";
import { MAX_RESULT_ROWS } from "./types";
import type { QueryResult, TableInfo } from "./types";

export function runStatements(db: Database, sql: string, readOnly = false): QueryResult[] {
  const results: QueryResult[] = [];
  let count = 0;
  let remaining = sql;
  while (remaining) {
    remaining = remaining.replace(/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "");
    if (!remaining) break;
    if (++count > 50) throw new Error("Run at most 50 statements at a time.");
    if (readOnly && (count > 1 || !/^(SELECT|WITH)\b/i.test(remaining))) {
      throw new Error("Challenge answers must contain one SELECT query (WITH is also supported).");
    }
    let stmt;
    try { stmt = db.prepare(remaining); }
    catch (error) {
      // SQLite accepts trailing unterminated comments and NUL terminators.
      if (String(error) === "Nothing to prepare") break;
      throw error;
    }
    try {
      // SQLite identifies the complete statement, including trigger bodies and
      // quoted semicolons. Avoid splitting SQL ourselves or preparing its tail
      // after an error (some PRAGMAs have side effects during preparation).
      remaining = remaining.slice(stmt.getSQL().length);
      const columns = stmt.getColumnNames();
      const values: QueryResult["values"] = [];
      let truncated = false;
      while (stmt.step()) {
        if (values.length === MAX_RESULT_ROWS) { truncated = true; break; }
        values.push(stmt.get());
      }
      if (columns.length) results.push({ columns, values, truncated });
    } finally { stmt.free(); }
  }
  return results;
}

export function readSchema(db: Database): TableInfo[] {
  const tables = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name");
  return (tables[0]?.values ?? []).map(([rawName, kind]) => {
    const name = String(rawName);
    let columns: TableInfo["columns"] = [];
    try {
      const info = db.exec(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
      columns = (info[0]?.values ?? []).map(row => ({ name: String(row[1]), type: String(row[2] ?? ""), pk: Number(row[5]) > 0 }));
    } catch {
      // A view can legitimately be broken after DROP TABLE practice.
    }
    return { name, kind: kind as TableInfo["kind"], columns };
  });
}

export function hasOpenTransaction(db: Database): boolean {
  // SQLite rejects BEGIN when a transaction/savepoint is already open.
  // Unlike exporting, this probe never commits or rolls back the user's work.
  try { db.run("BEGIN"); } catch { return true; }
  db.run("ROLLBACK");
  return false;
}
