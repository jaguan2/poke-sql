import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { SAFARI_ZONES, chooseSpecies, encounterTable, featuredZone, isWalkable, movePosition, rustlingPatch, tileAt, weatherFor, zoneById } from '../../src/features/safari/zones';
import { ASSIGNMENTS, changeSafariZone, createSafariSession, isSafariSession, walkSafari } from '../../src/features/safari/model';
import { checkSafariQuery, safariAssignment } from '../../src/features/safari/assignments';
import { recordSafariEncounter, recordSolvedEncounter, isPokemonEncounters } from '../../src/features/pokedex/encounters';
import { compareMysteryPokemon } from '../../src/features/mystery/model';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { nearSafariGrass } from '../fixtures/safari';
import { RANGER_POSITIONS, rangerSighting } from '../../src/features/safari/ranger';

test('Safari maps have connected safe starts and reachable encounter grass, with biome-appropriate canonical pools', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of SAFARI_ZONES) {
      expect(zone.map.length).toBeGreaterThanOrEqual(15);
      expect(zone.map[0].length).toBeGreaterThanOrEqual(20);
      expect(zone.map.every(row => row.length === zone.map[0].length)).toBe(true);
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
      for (let catches = 0; catches < 120; catches++) {
        const patch = rustlingPatch(zone, catches);
        expect(tileAt(zone, patch)).toBe('g');
        expect(seen.has(`${patch.x},${patch.y}`)).toBe(true);
      }
      expect(new Set(zone.species.map(species => species.id)).size).toBe(zone.species.length);
      for (const species of zone.species) {
        const row = db.exec('SELECT name, type1, type2 FROM pokedex WHERE id=?', [species.id])[0].values[0];
        expect(row[0]).toBe(species.name);
        const expected = { forest: ['bug', 'grass', 'electric'], wetlands: ['water'], ridge: ['rock', 'ground', 'steel'], meadow: ['normal', 'flying', 'fairy', 'psychic', 'grass'], coast: ['water', 'flying'], desert: ['ground', 'grass', 'dragon'], cave: ['rock', 'ground', 'dark', 'ghost', 'poison', 'flying', 'psychic'], tundra: ['ice'], volcano: ['fire', 'rock'] }[zone.id];
        expect(expected.some(type => row.slice(1).includes(type))).toBe(true);
      }
    }
  } finally { db.close(); }
});

test('guaranteed encounters follow the new patch after a catch instead of the old patch', () => {
  const zone = zoneById('forest');
  const patch = rustlingPatch(zone, 1);
  const approach = (['up', 'down', 'left', 'right'] as const).map(direction => ({ direction, position: movePosition(zone, patch, direction) })).find(entry => entry.position !== patch)!;
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
  const session = { ...createSafariSession(), catches: 1, position: approach.position };
  const encounter = walkSafari(session, reverse[approach.direction], 1, 0, 'new-hotspot');
  expect(encounter.position).toEqual(patch);
  expect(encounter.encounter?.pokemonId).toBe(10);
  const oldPatch = walkSafari({ ...nearSafariGrass(), catches: 1 }, 'left', 1, 0, 'old-hotspot');
  expect(oldPatch.position).toEqual(zone.rustle);
  expect(oldPatch.encounter).toBeNull();
});

test('movement blocks obstacles, encounters require walking in grass, and rustles and pity steps work', () => {
  const initial = createSafariSession();
  const wall = { ...initial, position: { x: 2, y: 8 } };
  expect(walkSafari(wall, 'left', 0, 0, 'wall')).toMatchObject({ position: wall.position, steps: 0, encounter: null });
  expect(walkSafari(initial, 'up', 0, 0, 'path').encounter).toBeNull();
  const near = nearSafariGrass();
  const encountered = walkSafari(near, 'left', 0.99, 0, 'rustle');
  expect(encountered.encounter).toMatchObject({ id: 'rustle', pokemonId: 10, assignmentId: 'field-notes' });
  expect(walkSafari(encountered, 'up', 0, 0, 'another')).toBe(encountered);
  expect(changeSafariZone(encountered, 'wetlands')).toBe(encountered);
  const pity = { ...initial, position: { x: 2, y: 3 }, grassSteps: 5 };
  expect(walkSafari(pity, 'right', 0.99, 0.99, 'pity').encounter).not.toBeNull();
  expect(changeSafariZone(initial, 'wetlands')).toMatchObject({ zoneId: 'wetlands', position: zoneById('wetlands').start });
});

test('weighted encounters exclude the last caught species and every zone remains featured over a nine-day cycle', () => {
  const zone = zoneById('forest');
  const samples = Array.from({ length: 1000 }, (_, index) => chooseSpecies(zone, index / 1000));
  expect(samples.filter(species => species.id === 10).length).toBeGreaterThan(samples.filter(species => species.id === 123).length * 4);
  for (const roll of [0, 0.3, 0.8, 0.9999]) expect(chooseSpecies(zone, roll, 10).id).not.toBe(10);
  expect(new Set(Array.from({ length: 9 }, (_, day) => featuredZone(`2026-11-${18 + day}`))).size).toBe(9);
});

test('the encounter table and actual rolls share rarity weights, weather boosts and last-catch exclusion', () => {
  const zone = { ...zoneById('forest'), species: [
    { id: 10, name: 'Caterpie', weight: 6, rarity: 'Common', favoredWeather: [] },
    { id: 46, name: 'Paras', weight: 3, rarity: 'Uncommon', favoredWeather: [] },
    { id: 25, name: 'Pikachu', weight: 1, rarity: 'Rare', favoredWeather: ['rain'] },
  ] } as const;
  expect(encounterTable(zone).rows.map(row => [row.pokemon.id, row.weight, row.chance])).toEqual([
    [10, 6, 0.6], [46, 3, 0.3], [25, 1, 0.1],
  ]);
  expect([0, 0.59, 0.6, 0.89, 0.9, 0.999].map(roll => chooseSpecies(zone, roll).id)).toEqual([10, 10, 46, 46, 25, 25]);
  const rain = encounterTable(zone, 'rain', 10);
  expect(rain.totalWeight).toBe(5);
  expect(rain.rows.map(row => [row.pokemon.id, row.chance])).toEqual([[46, 0.6], [25, 0.4]]);
  expect(chooseSpecies(zone, 0.65, 10, 'rain').id).toBe(25);
  expect(chooseSpecies(zone, 0.65, 10, 'clear').id).toBe(46);
});

test('rangers occupy trailhead tiles and have distinct anonymous clues for regular and visiting rares', () => {
  for (const zone of SAFARI_ZONES) {
    const point = RANGER_POSITIONS[zone.id];
    expect(isWalkable(zone, point)).toBe(true);
    expect(Math.abs(point.x - zone.start.x) + Math.abs(point.y - zone.start.y)).toBeLessThanOrEqual(4);
    const rareSpecies = zone.species.filter(pokemon => ['Rare', 'Legendary', 'Mythical'].includes(pokemon.rarity));
    const clues = new Set<string>();
    for (let day = 0; day < 365; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      const clue = rangerSighting(zone, weatherFor(zone, date), undefined, date);
      clues.add(clue);
    }
    expect(clues.size).toBe(rareSpecies.length);
    for (const clue of clues) {
      expect(clue).not.toMatch(/^No rare Pokémon/);
      for (const pokemon of rareSpecies) expect(clue).not.toContain(pokemon.name);
    }
  }
  const forest = zoneById('forest');
  expect(rangerSighting(forest, 'clear', 640, '2026-01-02')).toMatch(/same twig snap twice/);
  expect(rangerSighting(forest, 'clear', 251, '2026-01-02')).toMatch(/horns caught the light/);
  expect(rangerSighting(zoneById('ridge'), 'clear', 246, '2026-01-08')).toMatch(/^No rare Pokémon/);
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

test('Ember Foothills tracking clues identify one species and the ranger survey requires all ranked rows', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const zone = zoneById('volcano');
    const { rows, totalWeight } = encounterTable(zone, 'clear');
    let firstWeight = 0;
    for (const { pokemon, weight } of rows) {
      const pick = (firstWeight + weight / 2) / totalWeight;
      firstWeight += weight;
      const session = walkSafari(nearSafariGrass('volcano'), 'left', 0, pick, `ember-${pokemon.id}`);
      expect(session.encounter?.pokemonId).toBe(pokemon.id);
      const id = session.encounter!.assignmentId;
      expect(isSafariSession(session)).toBe(true);
      if ([58, 77, 607].includes(pokemon.id)) {
        expect(id).toBe('tracking');
        const answer = safariAssignment(id, pokemon).sql;
        expect(db.exec(answer)[0].values).toEqual([[pokemon.id]]);
        expect(checkSafariQuery(db, answer, pokemon.id, id).passed).toBe(true);
        expect(checkSafariQuery(db, 'SELECT id FROM pokedex WHERE id = 1', pokemon.id, id).passed).toBe(false);
      } else if (pokemon.id === 324) {
        expect(id).toBe('ranger-survey');
        expect(session.draft).toMatch(/^WITH route AS/);
        const sql = safariAssignment(id, pokemon).sql;
        expect(checkSafariQuery(db, sql, pokemon.id, id).results[0].values).toEqual([['Ponyta', 90], ['Salandit', 77], ['Growlithe', 60]]);
        expect(checkSafariQuery(db, sql, pokemon.id, id).passed).toBe(true);
        expect(checkSafariQuery(db, sql.replace('DESC', 'ASC'), pokemon.id, id).passed).toBe(false);
        expect(checkSafariQuery(db, "SELECT name, speed FROM pokedex WHERE name = 'Torkoal'", pokemon.id, id).passed).toBe(false);
      } else expect(id).toBe('field-notes');
    }
  } finally { db.close(); }
});

test('weather changes actual encounter outcomes and rotates within each habitat', () => {
  const forest = zoneById('forest');
  expect(chooseSpecies(forest, 0.96, undefined, 'clear').name).toBe('Scyther');
  expect(chooseSpecies(forest, 0.96, undefined, 'rain').name).toBe('Pikachu');
  const conditions = new Set(Array.from({ length: 9 }, (_, day) => weatherFor(forest, `2026-11-${18 + day}`)));
  expect([...conditions].sort()).toEqual(['clear', 'rain', 'sun']);
});

test('catches from expanded habitats restore without resetting the expedition', async () => {
  const [entry] = await entriesFor([872]);
  const session = changeSafariZone(createSafariSession(), 'tundra');
  const caught = { encounterId: 'snow-catch', pokemon: entry.pokemon, attempts: 1, caughtAt: '2026-11-18T12:00:00.000Z' };
  expect(isSafariSession({ ...session, catches: 1, encounter: { id: 'snow-catch', pokemonId: 872, assignmentId: 'field-notes', attempts: 1, outcome: "caught", fleeAfter: null }, lastCatch: caught })).toBe(true);
});

test('Safari save validation rejects impossible positions, forged pools and broken caught state', async () => {
  const initial = createSafariSession();
  expect(isSafariSession(JSON.parse(JSON.stringify(initial)))).toBe(true);
  const active = walkSafari(nearSafariGrass(), 'left', 0, 0, 'encounter');
  expect(isSafariSession(active)).toBe(true);
  expect(active.encounter!.level).toBeGreaterThanOrEqual(5);
  expect(active.encounter!.level).toBeLessThanOrEqual(50);
  expect(isSafariSession({ ...active, encounter: { ...active.encounter, level: undefined } })).toBe(true);
  for (const value of [null, {}, { ...initial, position: { x: 0, y: 0 } }, { ...initial, zoneId: 'unknown' },
    { ...initial, steps: -1 }, { ...active, encounter: { ...active.encounter, pokemonId: 1025 } },
    { ...active, encounter: { ...active.encounter, assignmentId: 'unknown' } },
    ...[null, '12', 4, 51, 12.5].map(level => ({ ...active, encounter: { ...active.encounter, level } })),
    { ...active, encounter: { ...active.encounter, outcome: "caught", fleeAfter: null } }]) expect(isSafariSession(value)).toBe(false);
  const [entry] = await entriesFor([10]);
  const caught = { ...active, encounter: { ...active.encounter!, outcome: "caught", fleeAfter: null, attempts: 1 }, catches: 1,
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
