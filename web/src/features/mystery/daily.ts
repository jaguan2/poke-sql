import { isMysteryRound } from "./model";
import { encounterLevel } from "../../shared/pokemon/encounter-level";
import type { MysteryRound } from "./model";

export const DAILY_SCHEDULE_VERSION = 1;
export const DAILY_SPECIES_COUNT = 1025;
const DAY_MS = 86_400_000;
const EPOCH = Date.parse("2026-01-01T00:00:00.000Z");

// Schedule v1 is deliberately frozen: adding species to the database must not
// change a published date's answer. A seeded Fisher–Yates shuffle gives a fixed
// permutation, and the absolute UTC day indexes that permutation cyclically.
const schedule = (() => {
  const ids = Array.from({ length: DAILY_SPECIES_COUNT }, (_, index) => index + 1);
  let state = 0x504f4b45;
  for (let index = ids.length - 1; index > 0; index--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const other = Math.floor(((state >>> 0) / 0x1_0000_0000) * (index + 1));
    [ids[index], ids[other]] = [ids[other], ids[index]];
  }
  return ids;
})();

export function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dailyPokemonForDate(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) || utcDateKey(new Date(timestamp)) !== date) {
    throw new Error("Use a valid UTC calendar date (YYYY-MM-DD).");
  }
  const day = Math.floor((timestamp - EPOCH) / DAY_MS);
  const index = ((day % schedule.length) + schedule.length) % schedule.length;
  return schedule[index];
}

export interface DailyMysteryRound extends MysteryRound {
  date: string;
  scheduleVersion: number;
}

export function createDailyMysteryRound(date: string, trainerDays = 0): DailyMysteryRound {
  return { date, scheduleVersion: DAILY_SCHEDULE_VERSION, targetId: dailyPokemonForDate(date),
    level: encounterLevel(crypto.randomUUID(), trainerDays), guessCount: 0, attempts: [] };
}

export function isDailyMysteryRound(value: unknown): value is DailyMysteryRound | null {
  if (value === null) return true;
  if (!isMysteryRound(value)) return false;
  const daily = value as MysteryRound & { date?: unknown; scheduleVersion?: unknown };
  if (daily.scheduleVersion !== DAILY_SCHEDULE_VERSION || typeof daily.date !== "string") return false;
  try { return daily.targetId === dailyPokemonForDate(daily.date); }
  catch { return false; }
}
