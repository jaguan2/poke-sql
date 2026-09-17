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
  // Unqualified SQL resolves temporary objects before main. Show that same
  // effective schema, including temporary practice tables and views.
  const tables = db.exec(`
    SELECT name, type, source FROM (
      SELECT name, type, 'temp' AS source FROM sqlite_temp_master
      UNION ALL
      SELECT name, type, 'main' AS source FROM sqlite_master
      WHERE name COLLATE NOCASE NOT IN (SELECT name FROM sqlite_temp_master WHERE type IN ('table', 'view'))
    ) WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name
  `);
  return (tables[0]?.values ?? []).map(([rawName, kind, source]) => {
    const name = String(rawName);
    let columns: TableInfo["columns"] = [];
    try {
      const info = db.exec(`PRAGMA ${source}.table_info("${name.replace(/"/g, '""')}")`);
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

// sql.js export closes and reopens the connection. Restore session settings so
// separate editor runs still behave like the same SQLite session. Transactions,
// temporary objects and attachments must be checked before calling this helper.
export function exportSnapshot(db: Database): Uint8Array {
  const pragmas = [
    "analysis_limit", "automatic_index", "busy_timeout", "cache_size", "cache_spill",
    "cell_size_check", "checkpoint_fullfsync", "count_changes", "empty_result_callbacks",
    "foreign_keys", "full_column_names", "fullfsync", "ignore_check_constraints",
    "journal_size_limit", "legacy_alter_table", "locking_mode", "max_page_count",
    "read_uncommitted", "recursive_triggers", "reverse_unordered_selects",
    "secure_delete", "short_column_names", "synchronous", "temp_store", "threads",
    "trusted_schema", "wal_autocheckpoint", "writable_schema", "query_only",
  ];
  const settings = pragmas.flatMap(name => {
    const value = db.exec(`PRAGMA ${name}`)[0]?.values[0]?.[0];
    return value === undefined ? [] : [{ name, value }];
  });
  // This deprecated pragma has no getter, but its effect is observable.
  const caseSensitiveLike = db.exec("SELECT 'a' LIKE 'A'")[0].values[0][0] === 0;
  const snapshot = db.export();
  for (const { name, value } of settings) {
    db.run(`PRAGMA ${name} = '${String(value).replace(/'/g, "''")}'`);
  }
  db.run(`PRAGMA case_sensitive_like = ${caseSensitiveLike ? 1 : 0}`);
  return snapshot;
}
