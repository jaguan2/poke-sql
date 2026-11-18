import type { QueryResult } from "./types";

/** Aliases do not matter; column order, value types, duplicates and NULLs do. */
export function matchesResults(actual: QueryResult[], expected: QueryResult[], ordered = false): boolean {
  if (actual.length !== 1 || expected.length !== 1) return false;
  const [a] = actual;
  const [e] = expected;
  if (a.truncated || e.truncated || a.columns.length !== e.columns.length || a.values.length !== e.values.length) return false;
  const encode = (rows: QueryResult["values"]) => rows.map(row => JSON.stringify(row.map(value =>
    value instanceof Uint8Array ? { blob: Array.from(value) } : value)));
  const left = encode(a.values);
  const right = encode(e.values);
  if (!ordered) { left.sort(); right.sort(); }
  return left.every((row, i) => row === right[i]);
}
