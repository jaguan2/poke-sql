import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { createDailyMysteryRound, DAILY_SCHEDULE_VERSION, DAILY_SPECIES_COUNT, dailyPokemonForDate, isDailyMysteryRound, utcDateKey } from '../src/daily-mystery';

const DAY_MS = 86_400_000;
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);

test('schedule v1 keeps published date assignments stable', () => {
  expect(DAILY_SCHEDULE_VERSION).toBe(1);
  expect(['2026-01-01', '2028-02-29', '2030-12-31'].map(dailyPokemonForDate)).toEqual([243, 43, 163]);
});

test('a complete daily cycle contains every original species once, including across its boundary', async () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const cycle = Array.from({ length: DAILY_SPECIES_COUNT }, (_, day) => dailyPokemonForDate(dateKey(start + day * DAY_MS)));
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const species = db.exec('SELECT id FROM pokemon ORDER BY id')[0].values.map(row => row[0]);
    expect([...cycle].sort((a, b) => a - b)).toEqual(species);
  } finally { db.close(); }
  expect(dailyPokemonForDate(dateKey(start + DAILY_SPECIES_COUNT * DAY_MS))).toBe(cycle[0]);
  const crossing = Array.from({ length: DAILY_SPECIES_COUNT }, (_, day) => dailyPokemonForDate(dateKey(start + (day + 900) * DAY_MS)));
  expect(new Set(crossing).size).toBe(DAILY_SPECIES_COUNT);
});

test('calendar years never repeat a species and matching dates differ the following year', () => {
  for (let year = 2024; year <= 2040; year++) {
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year + 1, 0, 1);
    const seen = new Set<number>();
    for (let time = start; time < end; time += DAY_MS) {
      const date = dateKey(time);
      const id = dailyPokemonForDate(date);
      expect(seen.has(id), `${date} must not repeat within ${year}`).toBe(false);
      seen.add(id);
      if (!date.endsWith('-02-29')) {
        expect(dailyPokemonForDate(`${year + 1}${date.slice(4)}`), `${date} must change the following year`).not.toBe(id);
      }
    }
    expect(seen.size).toBe((end - start) / DAY_MS);
  }
});

test('UTC dates, leap days, dates before the epoch, and invalid dates are handled explicitly', () => {
  expect(utcDateKey(new Date('2026-11-17T19:01:00-05:00'))).toBe('2026-11-18');
  expect(utcDateKey(new Date('2026-11-18T08:59:00+09:00'))).toBe('2026-11-17');
  expect(new Set(['2028-02-28', '2028-02-29', '2028-03-01'].map(dailyPokemonForDate)).size).toBe(3);
  expect(dailyPokemonForDate('2025-12-31')).not.toBe(dailyPokemonForDate('2026-01-01'));
  expect(dailyPokemonForDate('2000-02-29')).toBeGreaterThan(0);
  for (const date of ['2026-02-29', '2100-02-29', '2026-02-30', '2026-13-01', '2026-11-17T12:00:00Z', '11/17/2026', 'invalid']) {
    expect(() => dailyPokemonForDate(date), date).toThrow(/valid UTC calendar date/);
  }
});

test('saved daily rounds are bound to their date and schedule version', () => {
  const round = createDailyMysteryRound('2026-11-17');
  expect(round).toMatchObject({ date: '2026-11-17', scheduleVersion: DAILY_SCHEDULE_VERSION, guessCount: 0, attempts: [] });
  expect(isDailyMysteryRound(JSON.parse(JSON.stringify(round)))).toBe(true);
  expect(isDailyMysteryRound(null)).toBe(true);
  for (const invalid of [
    {}, { ...round, scheduleVersion: 999 }, { ...round, date: '2026-02-29' },
    { ...round, targetId: dailyPokemonForDate('2026-11-18') }, { ...round, attempts: [null] },
    { targetId: round.targetId, guessCount: 0, attempts: [] },
  ]) expect(isDailyMysteryRound(invalid)).toBe(false);
});
