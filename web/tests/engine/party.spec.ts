import { test, expect } from '@playwright/test';
import { applyCollectionCommand, createCollection, deposit } from '../../src/features/pc/model';
import { migrateCollection } from '../../src/features/pc/migrations';
import { indexCollection, filterCollection } from '../../src/features/pc/collection-index';
import { isCollection } from '../../src/features/pc/validation';
import type { CaptureReceipt } from '../../src/features/pc/types';

const receipt = (id: string, species = 25): CaptureReceipt => ({ id, pokemon: { id: species, name: species === 25 ? 'Pikachu' : 'Eevee', type1: species === 25 ? 'electric' : 'normal', type2: null, generationId: 1, heightM: .4, weightKg: 6 },
  source: 'safari', sources: ['safari'], level: 17, ball: 'great-ball', caughtAt: '2026-11-27T12:00:00.000Z', firstRecordedAt: '2026-11-27T12:00:00.000Z', location: 'Route 1', attempts: 2, sql: 'SELECT * FROM pokedex WHERE id=25' });

test('collection migration is additive and idempotent, retaining unknown capture fields and original metadata', () => {
  const current = deposit(createCollection(), [receipt('a'), receipt('b')]);
  const { schemaVersion: _version, partyIds: _party, ...old } = current;
  const original = { ...old, featuredIds: ['b'], futureSetting: { keep: true }, captures: old.captures.map(capture => ({ ...capture, importedTraits: { untouched: [1, 2] } })) };
  const migrated = migrateCollection(original);
  expect(migrated.schemaVersion).toBe(2); expect(migrated.partyIds).toEqual([]); expect(migrated.featuredIds).toEqual(['b']);
  expect(migrated.captures).toBe(original.captures); expect(migrated.captures).toEqual(original.captures);
  const { captures: _captures, ...metadata } = original;
  expect(migrated.migrationBackup?.metadata).toEqual(metadata);
  expect(migrateCollection(migrated)).toBe(migrated);
  expect(original).not.toHaveProperty('schemaVersion');
});

test('unsupported or corrupt saves fail without replacing their data', () => {
  const collection = deposit(createCollection(), [receipt('a')]);
  expect(() => migrateCollection({ ...collection, schemaVersion: 99 })).toThrow('newer version');
  expect(() => migrateCollection({ ...collection, partyIds: ['missing'] })).toThrow('original saved data has been kept');
  expect(isCollection({ ...collection, partyIds: ['a', 'a'] })).toBe(false);
  expect(() => migrateCollection({ ...collection, schemaVersion: undefined, captures: [{ ...collection.captures[0], slot: 99 }] })).toThrow('could not be migrated');
});

test('party commands keep six distinct owned instances, separate from showcases and physical boxes', () => {
  let collection = deposit(createCollection(), 'abcdefg'.split('').map(id => receipt(id)));
  collection = applyCollectionCommand(collection, { type: 'featured', ids: ['g'] });
  for (const id of 'abcdef') collection = applyCollectionCommand(collection, { type: 'party-add', id });
  const full = collection;
  expect(applyCollectionCommand(full, { type: 'party-add', id: 'a' })).toBe(full);
  expect(() => applyCollectionCommand(full, { type: 'party-add', id: 'g' })).toThrow('up to six');
  expect(() => applyCollectionCommand(full, { type: 'party-add', id: 'unknown' })).toThrow('you own');
  collection = applyCollectionCommand(collection, { type: 'party-leader', id: 'c' });
  collection = applyCollectionCommand(collection, { type: 'party-reorder', id: 'b', direction: 'earlier' });
  expect(collection.partyIds).toEqual(['c', 'b', 'a', 'd', 'e', 'f']);
  collection = applyCollectionCommand(collection, { type: 'move', id: 'c', boxId: 64, slot: 12 });
  expect(collection.partyIds[0]).toBe('c'); expect(collection.captures).toHaveLength(7); expect(collection.featuredIds).toEqual(['g']);
  collection = applyCollectionCommand(collection, { type: 'party-remove', id: 'c' });
  expect(collection.partyIds[0]).toBe('b'); expect(collection.captures.some(capture => capture.id === 'c')).toBe(true);
  expect(isCollection(collection)).toBe(true);
});

test('collection filters preserve instances, combine search and keep unknown levels last', () => {
  let collection = deposit(createCollection(), [receipt('a'), { ...receipt('b'), level: 32, shiny: true }, { ...receipt('c', 133), source: 'legacy', level: null }]);
  collection = applyCollectionCommand(collection, { type: 'favorite', id: 'a', favorite: true });
  collection = applyCollectionCommand(collection, { type: 'nickname', id: 'a', name: 'Sparky' });
  collection = applyCollectionCommand(collection, { type: 'party-add', id: 'c' });
  const index = indexCollection(collection), ids = (filter: 'all' | 'favorites' | 'shiny' | 'duplicates' | 'party', search = '') => filterCollection(collection, index, search, filter, 'level').map(capture => capture.id);
  expect(ids('duplicates')).toEqual(['b', 'a']); expect(ids('favorites', 'spark')).toEqual(['a']); expect(ids('shiny')).toEqual(['b']); expect(ids('party')).toEqual(['c']);
  expect(ids('all')).toEqual(['b', 'a', 'c']);
  expect(index.byBox.get(1)?.get(1)?.id).toBe('b'); expect(index.byId.get('c')?.pokemon.id).toBe(133);
  expect(collection.captures.map(capture => capture.id)).toEqual(['a', 'b', 'c']);
});

test('ten thousand captures retain unique placements and indexed lookup results', async ({}, info) => {
  const start = performance.now(), collection = deposit(createCollection(), Array.from({ length: 10000 }, (_, i) => receipt(`large:${i}`, i % 2 ? 25 : 133)));
  const deposited = performance.now(), index = indexCollection(collection), indexed = performance.now();
  const matches = filterCollection(collection, index, 'Pikachu', 'duplicates', 'box'), filtered = performance.now();
  expect(collection.captures).toHaveLength(10000); expect(collection.boxes).toHaveLength(334); expect(isCollection(collection)).toBe(true);
  expect(index.byId.get('large:9999')).toMatchObject({ boxId: 334, slot: 9 }); expect(matches).toHaveLength(5000);
  expect(new Set(collection.captures.map(capture => `${capture.boxId}:${capture.slot}`)).size).toBe(10000);
  await info.attach('collection-operation-timings.json', { body: JSON.stringify({ count: 10000, depositMs: deposited - start, indexMs: indexed - deposited, filterMs: filtered - indexed }), contentType: 'application/json' });
});

test('batch allocation honors the chosen box, wraps into holes and skips repeated rewards', () => {
  let collection = deposit(createCollection(), Array.from({ length: 1920 }, (_, i) => receipt(`full:${i}`)));
  collection = applyCollectionCommand(collection, { type: 'add-box' });
  collection = applyCollectionCommand(collection, { type: 'move', id: 'full:3', boxId: 65, slot: 10 });
  collection = applyCollectionCommand(collection, { type: 'destination', boxId: 64 });
  collection = deposit(collection, [receipt('full:3'), receipt('new:a'), receipt('new:b')]);
  expect(collection.captures.find(capture => capture.id === 'new:a')).toMatchObject({ boxId: 65, slot: 0 });
  expect(collection.captures.find(capture => capture.id === 'new:b')).toMatchObject({ boxId: 65, slot: 1 });
  expect(collection.captures).toHaveLength(1922);
});
