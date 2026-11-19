import { test, expect } from '@playwright/test';
import { applyCollectionCommand, createCollection, deposit, importLegacy } from '../../src/features/pc/model';
import { isCollection } from '../../src/features/pc/validation';
import type { CaptureReceipt } from '../../src/features/pc/types';
import { encounterLevel } from '../../src/shared/pokemon/encounter-level';
import { trainerAgeDays } from '../../src/shared/trainer/identity';

test('encounter levels rise with full days since Trainer ID issuance and retain variation at the cap', () => {
  const issuedAt = '2026-11-19T12:00:00.000Z';
  const start = Date.parse(issuedAt);
  const day = 86_400_000;
  const age = (offset: number) => trainerAgeDays(issuedAt, start + offset);
  expect(age(-1)).toBe(0);
  expect(age(day - 1)).toBe(0);
  expect(age(day)).toBe(1);
  for (const [offset, floor] of [[0, 5], [14 * day, 19], [40 * day, 45], [100 * day, 45]]) {
    const levels = Array.from({ length: 120 }, (_, index) => encounterLevel(`encounter-${index}`, age(offset)));
    expect([...new Set(levels)].sort((a, b) => a - b)).toEqual(Array.from({ length: 6 }, (_, index) => floor + index));
  }
});

const pokemon = { id: 25, name: 'Pikachu', type1: 'electric', type2: null, generationId: 1, heightM: 0.4, weightKg: 6 };
function receipt(id: string): CaptureReceipt {
  return { id, pokemon, source: 'safari', sources: ['safari'], level: 17, ball: 'great-ball', caughtAt: '2026-11-19T12:00:00.000Z',
    firstRecordedAt: '2026-11-19T12:00:00.000Z', location: 'Verdant Forest', attempts: 2, sql: "SELECT id, name, type1, type2 FROM pokedex WHERE name = 'Pikachu';" };
}

test('individual catches fill sixty-four boxes and expand without losing a reward', () => {
  const collection = deposit(createCollection(), Array.from({ length: 1921 }, (_, index) => receipt(`safari:${index}`)));
  expect(collection.captures).toHaveLength(1921);
  expect(collection.boxes).toHaveLength(65);
  expect(collection.captures[29]).toMatchObject({ id: 'safari:29', boxId: 1, slot: 29, level: 17, ball: 'great-ball' });
  expect(collection.captures[30]).toMatchObject({ id: 'safari:30', boxId: 2, slot: 0 });
  expect(collection.captures[1920]).toMatchObject({ id: 'safari:1920', boxId: 65, slot: 0 });
  expect(deposit(collection, [receipt('safari:0')]).captures).toHaveLength(1921);
  expect(isCollection(collection)).toBe(true);
});

test('moving swaps individuals, reuses empty slots and respects the chosen catch destination', () => {
  let collection = deposit(createCollection(), [receipt('safari:a'), receipt('safari:b')]);
  collection = applyCollectionCommand(collection, { type: 'move', id: 'safari:a', boxId: 1, slot: 1 });
  expect(collection.captures.map(capture => [capture.id, capture.boxId, capture.slot])).toEqual([['safari:a', 1, 1], ['safari:b', 1, 0]]);
  collection = applyCollectionCommand(collection, { type: 'move', id: 'safari:a', boxId: 64, slot: 29 });
  collection = applyCollectionCommand(collection, { type: 'destination', boxId: 64 });
  collection = deposit(collection, [receipt('safari:c')]);
  expect(collection.captures.find(capture => capture.id === 'safari:c')).toMatchObject({ boxId: 64, slot: 0 });
  expect(collection.captures.find(capture => capture.id === 'safari:a')).toMatchObject({ boxId: 64, slot: 29 });
});

test('a profile can feature six owned individuals in a saved order, with no invented or repeated occupants', () => {
  let collection = deposit(createCollection(), ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => receipt(id)));
  collection = applyCollectionCommand(collection, { type: 'featured', ids: ['f', 'e', 'd', 'c', 'b', 'a'] });
  expect(collection.featuredIds).toEqual(['f', 'e', 'd', 'c', 'b', 'a']);
  expect(() => applyCollectionCommand(collection, { type: 'featured', ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })).toThrow('up to six');
  expect(() => applyCollectionCommand(collection, { type: 'featured', ids: ['a', 'a'] })).toThrow('up to six');
  expect(() => applyCollectionCommand(collection, { type: 'featured', ids: ['not-caught'] })).toThrow('up to six');
  collection = applyCollectionCommand(collection, { type: 'nickname', id: 'f', name: 'Sparky' });
  expect(collection.captures.find(capture => capture.id === collection.featuredIds[0])?.nickname).toBe('Sparky');
});

test('legacy migration keeps its original bytes and never awards the saved solved encounter twice', () => {
  const imported = { ...receipt('legacy:25'), source: 'legacy' as const, level: null, ball: null, caughtAt: null, location: null, sql: null };
  const legacy = { discoveries: [imported, imported], consumedIds: ['safari:old'], backup: { encounters: 'original bytes' } };
  const collection = importLegacy(createCollection(), legacy);
  expect(collection.captures).toHaveLength(1);
  expect(collection.captures[0]).toMatchObject({ id: 'legacy:25', level: null, ball: null, boxId: 1, slot: 0 });
  expect(collection.legacyBackup).toEqual({ encounters: 'original bytes' });
  expect(deposit(importLegacy(collection, legacy), [receipt('safari:old')]).captures).toHaveLength(1);
  expect(deposit(collection, [receipt('safari:new')]).captures).toHaveLength(2);
});

test('a verified pending win keeps its capture details when the journal was saved before PC initialization', () => {
  const pending = receipt('safari:pending');
  const legacy = { ...receipt('legacy:25'), source: 'legacy' as const, level: null, ball: null, caughtAt: null, sql: null };
  const awarded = deposit(createCollection(), [pending]);
  const imported = importLegacy(awarded, { discoveries: [legacy], consumedIds: ['safari:pending'], backup: { encounters: 'saved after winning' } });
  expect(imported.captures).toHaveLength(1);
  expect(imported.captures[0]).toMatchObject({ id: 'safari:pending', level: 17, ball: 'great-ball' });
  const earlier = importLegacy(awarded, { discoveries: [{ ...legacy, firstRecordedAt: '2026-01-01T00:00:00.000Z' }], consumedIds: [], backup: {} });
  expect(earlier.captures.map(capture => capture.id)).toEqual(['safari:pending', 'legacy:25']);
});
