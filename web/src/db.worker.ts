import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { exportSnapshot, hasOpenTransaction, readSchema, runStatements } from "./engine";
import { CHALLENGES, matchesResults } from "./challenges";
import { pickMysteryTarget, runMysteryQuery } from "./mystery";
import { readAchievementCatalog } from "./achievements";
import type { AchievementCatalog, DbReply, DbRequest, TableInfo } from "./types";

let SQL: SqlJsStatic;
let db: Database;
let original: Uint8Array;
let challengeSchema: TableInfo[];

function checkpoint(): Pick<DbReply, "snapshot" | "notice"> {
  if (hasOpenTransaction(db)) return { notice: "Transaction open. COMMIT to save changes; stopping a query or reloading discards uncommitted work." };
  if (db.exec("SELECT name FROM sqlite_temp_master").length || db.exec("PRAGMA database_list")[0].values.some(row => row[1] !== "main" && row[1] !== "temp")) {
    return { notice: "Temporary tables or attached databases are in use. Saving resumes after you drop temporary objects and detach databases; these remain session-only." };
  }
  return { snapshot: exportSnapshot(db) };
}

async function handle(request: DbRequest): Promise<DbReply> {
  if (request.action === "init") {
    SQL = await initSqlJs({ locateFile: () => wasmUrl });
    original = request.original;
    const originalDb = new SQL.Database(original);
    let achievementCatalog: AchievementCatalog;
    let originalVersion: number;
    try {
      challengeSchema = readSchema(originalDb); achievementCatalog = readAchievementCatalog(originalDb);
      originalVersion = Number(originalDb.exec("PRAGMA user_version")[0].values[0][0]);
    }
    finally { originalDb.close(); }
    let notice: string | undefined;
    try {
      db = new SQL.Database(request.saved ?? original);
      if (db.exec("PRAGMA quick_check")[0]?.values[0]?.[0] !== "ok") throw new Error("Invalid saved database");
    } catch {
      db?.close();
      db = new SQL.Database(original);
      notice = "The saved database could not be read. The original Pokédex has been restored.";
    }
    // Never overwrite an older workspace just because the bundled dataset
    // expanded. The user can explicitly reset after reviewing the notice.
    const datasetUpdateAvailable = Number(db.exec("PRAGMA user_version")[0].values[0][0]) < originalVersion;
    return { schema: readSchema(db), challengeSchema, achievementCatalog, datasetUpdateAvailable, ...checkpoint(), notice };
  }
  if (request.action === "reset") {
    db.close();
    db = new SQL.Database(original);
    return { schema: readSchema(db), datasetUpdateAvailable: false, ...checkpoint() };
  }
  const start = performance.now();
  if ("sql" in request && request.sql.length > 100_000) throw new Error("Keep SQL scripts below 100,000 characters.");
  if (request.action === "mystery-start" || request.action === "mystery-query") {
    const mysteryDb = new SQL.Database(original);
    try {
      mysteryDb.run("PRAGMA query_only = ON");
      if (request.action === "mystery-start") return { schema: readSchema(db), mysteryTargetId: pickMysteryTarget(mysteryDb, request.previousId) };
      return { schema: readSchema(db), ...runMysteryQuery(mysteryDb, request.sql, request.targetId), ms: performance.now() - start };
    } finally { mysteryDb.close(); }
  }
  if (request.action === "check") {
    const challenge = CHALLENGES.find(c => c.id === request.challengeId);
    if (!challenge) throw new Error("Unknown challenge.");
    const answerDb = new SQL.Database(original);
    const referenceDb = new SQL.Database(original);
    try {
      answerDb.run("PRAGMA query_only = ON");
      const results = runStatements(answerDb, request.sql, true);
      const expected = runStatements(referenceDb, challenge.solution);
      return { schema: readSchema(db), challengeSchema, results, passed: matchesResults(results, expected, challenge.ordered), ms: performance.now() - start };
    } finally { answerDb.close(); referenceDb.close(); }
  }
  let error: string | undefined;
  let results: DbReply["results"];
  try { results = runStatements(db, request.sql); }
  catch (e) { error = (e as Error).message; }
  // Earlier statements may have succeeded before a later SQL error.
  return { results, error, schema: readSchema(db), ms: performance.now() - start, ...checkpoint() };
}

self.onmessage = async (event: MessageEvent<DbRequest & { id: number }>) => {
  try { self.postMessage({ id: event.data.id, ...await handle(event.data) }); }
  catch (e) { self.postMessage({ id: event.data.id, error: (e as Error).message, schema: db ? readSchema(db) : [] }); }
};
