import type { QueryResult } from "../shared/sql/types";

export interface SavedQuery { id: string; name: string; sql: string }

export type RunState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "ok"; results: QueryResult[]; ms: number; passed?: boolean; mysteryGuess?: boolean };

export type PracticeSelection = { kind: "challenge" | "sample"; id: string } | { kind: "mystery" } | null;
export type QueryContext =
  | { kind: "practice" }
  | { kind: "challenge"; challengeId: string }
  | { kind: "random-mystery"; targetId: number }
  | { kind: "daily-mystery"; targetId: number; date: string };

