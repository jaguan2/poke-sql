import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { SAFARI_ZONES, chooseSpecies, featuredZone, isWalkable, movePosition, tileAt, zoneById } from '../../src/features/safari/zones';
import { ASSIGNMENTS, changeSafariZone, createSafariSession, isSafariSession, walkSafari } from '../../src/features/safari/model';
import { checkSafariQuery, safariAssignment } from '../../src/features/safari/assignments';
import { recordSafariEncounter, recordSolvedEncounter, isPokemonEncounters } from '../../src/features/pokedex/encounters';
import { compareMysteryPokemon } from '../../src/features/mystery/model';
import { entriesFor } from '../fixtures/pokemon-encounters';

test('Safari maps have connected safe starts and reachable encounter grass, with biome-appropriate canonical pools', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of SAFARI_ZONES) {
      expect(zone.map).toHaveLength(10);
      expect(zone.map.every(row => row.length === 15)).toBe(true);
      expect(isWalkable(zone, zone.start)).toBe(true);
      expect(tileAt(zone, zone.start)).not.toBe('g');
      const seen = new Set<string>();
      const queue = [zone.start];
      while (queue.length) {
        const position = queue.shift()!;
        const key = `${position.x},${position.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const direction of ['up', 'down', 'left', 'right'] as const) {
          const next = movePosition(zone, position, direction);
          if (next !== position) queue.push(next);
        }
      }
      expect(seen.has(`${zone.rustle.x},${zone.rustle.y}`)).toBe(true);
      expect(tileAt(zone, zone.rustle)).toBe('g');
      expect(new Set(zone.species.map(species => species.id)).size).toBe(zone.species.length);
      for (const species of zone.species) {
        const row = db.exec('SELECT name, type1, type2 FROM pokedex WHERE id=?', [species.id])[0].values[0];
        expect(row[0]).toBe(species.name);
        const expected = zone.id === 'forest' ? ['bug', 'grass', 'electric'] : zone.id === 'wetlands' ? ['water'] : ['rock', 'ground', 'steel'];
        expect(expected.some(type => row.slice(1).includes(type))).toBe(true);
      }
    }
  } finally { db.close(); }
});

test('movement blocks obstacles, encounters require walking in grass, and rustles and pity steps work', () => {
  const initial = createSafariSession();
  const wall = { ...initial, position: { x: 1, y: 1 } };
  expect(walkSafari(wall, 'left', 0, 0, 'wall')).toMatchObject({ position: wall.position, steps: 0, encounter: null });
  expect(walkSafari(initial, 'up', 0, 0, 'path').encounter).toBeNull();
  const near = { ...initial, position: { x: 5, y: 6 } };
  const encountered = walkSafari(near, 'left', 0.99, 0, 'rustle');
  expect(encountered.encounter).toMatchObject({ id: 'rustle', pokemonId: 10, assignmentId: 'field-notes' });
  expect(walkSafari(encountered, 'up', 0, 0, 'another')).toBe(encountered);
  expect(changeSafariZone(encountered, 'wetlands')).toBe(encountered);
  const pity = { ...initial, position: { x: 2, y: 2 }, grassSteps: 5 };
  expect(walkSafari(pity, 'right', 0.99, 0.99, 'pity').encounter).not.toBeNull();
  expect(changeSafariZone(initial, 'wetlands')).toMatchObject({ zoneId: 'wetlands', position: zoneById('wetlands').start });
});

test('weighted encounters exclude the last caught species and every zone remains featured over a three-day cycle', () => {
  const zone = zoneById('forest');
  const samples = Array.from({ length: 1000 }, (_, index) => chooseSpecies(zone, index / 1000));
  expect(samples.filter(species => species.id === 10).length).toBeGreaterThan(samples.filter(species => species.id === 123).length * 4);
  for (const roll of [0, 0.3, 0.8, 0.9999]) expect(chooseSpecies(zone, roll, 10).id).not.toBe(10);
  expect(new Set(['2026-11-18', '2026-11-19', '2026-11-20'].map(featuredZone)).size).toBe(3);
  expect(featuredZone('2026-11-18')).toBe(featuredZone('2026-11-18'));
});

test('all Safari assignments grade against canonical rows, preserve NULLs/order, and reject writes and multiple statements', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only=ON');
    for (const species of SAFARI_ZONES.flatMap(zone => zone.species)) {
      for (const assignment of ASSIGNMENTS) {
        const reply = checkSafariQuery(db, safariAssignment(assignment, species).sql, species.id, assignment);
        expect(reply.passed).toBe(true);
        expect(reply.safariPokemon.name).toBe(species.name);
        expect(reply.results[0].values.length).toBeGreaterThan(0);
      }
    }
    expect(checkSafariQuery(db, "SELECT 10, 'Caterpie', 'bug', NULL", 10, 'field-notes').passed).toBe(true);
    expect(checkSafariQuery(db, "SELECT 'Caterpie', 45, 30, 45", 10, 'stat-scan').passed).toBe(true);
    expect(checkSafariQuery(db, "SELECT 'Paras', 'bug', 1 UNION ALL SELECT 'Paras', 'grass', 2", 46, 'type-tracker').passed).toBe(true);
    expect(checkSafariQuery(db, "SELECT 'Paras', 'grass', 2 UNION ALL SELECT 'Paras', 'bug', 1", 46, 'type-tracker').passed).toBe(false);
    expect(checkSafariQuery(db, "SELECT 10, 'Caterpie', 'bug', 'NULL'", 10, 'field-notes').passed).toBe(false);
    expect(checkSafariQuery(db, 'SELECT name, id, type1, type2 FROM pokedex WHERE id=10', 10, 'field-notes').passed).toBe(false);
    expect(checkSafariQuery(db, 'SELECT id, name, type1, type2 FROM pokedex WHERE id=13', 10, 'field-notes').passed).toBe(false);
    expect(() => checkSafariQuery(db, 'DELETE FROM pokemon', 10, 'field-notes')).toThrow(/one SELECT/);
    expect(() => checkSafariQuery(db, 'SELECT 1; SELECT 2;', 10, 'field-notes')).toThrow(/one SELECT/);
    expect(() => checkSafariQuery(db, 'WITH x AS (SELECT 1) DELETE FROM pokemon', 10, 'field-notes')).toThrow();
    expect(() => checkSafariQuery(db, 'SELECT 1', 1025, 'field-notes')).toThrow(/could not be restored/);
  } finally { db.close(); }
});

test('Safari save validation rejects impossible positions, forged pools and broken caught state', async () => {
  const initial = createSafariSession();
  expect(isSafariSession(JSON.parse(JSON.stringify(initial)))).toBe(true);
  const active = walkSafari({ ...initial, position: { x: 5, y: 6 } }, 'left', 0, 0, 'encounter');
  expect(isSafariSession(active)).toBe(true);
  for (const value of [null, {}, { ...initial, position: { x: 0, y: 0 } }, { ...initial, zoneId: 'unknown' },
    { ...initial, steps: -1 }, { ...active, encounter: { ...active.encounter, pokemonId: 1025 } },
    { ...active, encounter: { ...active.encounter, assignmentId: 'unknown' } },
    { ...active, encounter: { ...active.encounter, caught: true } }]) expect(isSafariSession(value)).toBe(false);
  const [entry] = await entriesFor([10]);
  const caught = { ...active, encounter: { ...active.encounter!, caught: true, attempts: 1 }, catches: 1,
    lastCatch: { encounterId: 'encounter', pokemon: entry.pokemon, attempts: 1, caughtAt: entry.firstFoundAt } };
  expect(isSafariSession(caught)).toBe(true);
});

test('Safari and mystery discoveries merge into one species without inflating achievements or resetting first registration', async () => {
  const [entry] = await entriesFor([10]);
  let collection = recordSolvedEncounter([], { targetId: 10, guessCount: 3, attempts: [{ sql: 'SELECT 10 AS id', feedback: compareMysteryPokemon(entry.pokemon, entry.pokemon) }] }, 'random', new Date(entry.firstFoundAt));
  const firstFoundAt = collection[0].firstFoundAt;
  const caught = { encounterId: 'one', pokemon: entry.pokemon, attempts: 2, caughtAt: '2026-11-18T00:00:00.000Z' };
  collection = recordSafariEncounter(collection, caught);
  expect(collection).toHaveLength(1);
  expect(collection[0]).toMatchObject({ firstFoundAt, bestGuessCount: 2, sources: ['random', 'safari'] });
  expect(recordSafariEncounter(collection, caught)).toBe(collection);
  expect(isPokemonEncounters(collection)).toBe(true);
  expect(recordSafariEncounter(collection, { ...caught, caughtAt: 'invalid' })).toBe(collection);
  collection = recordSolvedEncounter(collection, { targetId: 10, guessCount: 3, attempts: [{ sql: 'SELECT 10 AS id', feedback: compareMysteryPokemon(entry.pokemon, entry.pokemon) }] }, 'daily');
  expect(collection[0].sources).toEqual(['random', 'safari', 'daily']);
  expect(isPokemonEncounters(collection)).toBe(true);
});
