import { loadSnapshot, saveSnapshot } from "./storage";
import type { DbReply, DbRequest, TableInfo } from "./types";
export { MAX_RESULT_ROWS } from "./types";
export type { QueryResult, TableInfo } from "./types";

export const QUERY_TIMEOUT_MS = 8000;
let worker: Worker | null = null;
let original: Uint8Array;
let saved: Uint8Array | undefined;
let loaded = false;
let initPromise: Promise<DbReply> | null = null;
let nextId = 0;
let pending: { id: number; resolve: (reply: DbReply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

export function cancelQuery(reason = "Query stopped. Restored the last completed save; uncommitted work was discarded."): void {
  if (!pending) return;
  worker?.terminate();
  worker = null;
  initPromise = null;
  clearTimeout(pending.timer);
  pending.reject(new Error(reason));
  pending = null;
}

function request(data: DbRequest): Promise<DbReply> {
  if (!worker || pending) return Promise.reject(new Error("The database is busy. Wait or stop the current query."));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => cancelQuery(data.action === "init"
      ? "Database loading timed out. Reload to try again."
      : "Query exceeded 8 seconds and was stopped. Restored the last completed save; uncommitted work was discarded."), data.action === "init" ? 30000 : QUERY_TIMEOUT_MS);
    pending = { id, resolve, reject, timer };
    worker!.postMessage({ ...data, id });
  });
}

export function initDb(): Promise<DbReply> {
  initPromise ??= (async () => {
    let storageNotice: string | undefined;
    if (!loaded) {
      const response = await fetch(`${import.meta.env.BASE_URL}pokemon.sqlite`);
      if (!response.ok) throw new Error(`Failed to load database (${response.status}).`);
      original = new Uint8Array(await response.arrayBuffer());
      try { saved = await loadSnapshot(); }
      catch { storageNotice = "Local database storage is unavailable. Changes will last only for this session."; }
      loaded = true;
    }
    worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
    worker.onerror = () => {
      if (pending) cancelQuery("The SQL worker stopped unexpectedly. Run again to restore the last completed save.");
      else {
        // An idle worker can also fail; do not send the next query to a dead
        // worker and make the user wait for an avoidable timeout.
        worker?.terminate(); worker = null; initPromise = null;
      }
    };
    worker.onmessage = (event: MessageEvent<DbReply & { id: number }>) => {
      if (!pending || event.data.id !== pending.id) return;
      const active = pending;
      pending = null;
      clearTimeout(active.timer);
      active.resolve(event.data);
    };
    const reply = await request({ action: "init", original, saved });
    if (reply.error) throw new Error(reply.error);
    saved = reply.snapshot ?? saved;
    return { ...reply, notice: reply.notice ?? storageNotice };
  })().catch(error => {
    worker?.terminate(); worker = null; initPromise = null;
    throw error;
  });
  return initPromise;
}

async function execute(data: DbRequest): Promise<DbReply> {
  await initDb();
  const reply = await request(data);
  if (reply.snapshot) {
    saved = reply.snapshot;
    try { await saveSnapshot(saved); }
    catch { reply.notice = "Could not save the database on this device. Changes are available only in this session."; }
  }
  return reply;
}

export const runQuery = (sql: string) => execute({ action: "run", sql });
export const checkChallenge = (sql: string, challengeId: string) => execute({ action: "check", sql, challengeId });
export const resetDb = () => execute({ action: "reset" });

export function schemaForAutocomplete(schema: TableInfo[]): Record<string, string[]> {
  return Object.fromEntries(schema.map(table => [table.name, table.columns.map(column => column.name)]));
}
