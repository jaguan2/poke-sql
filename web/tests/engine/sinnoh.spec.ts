import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { areaTrack } from '../../src/features/music/catalog';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { createBag } from '../../src/features/safari/bag-model';
import { checkHoneyTree, createSafariSession, recordSafariReply, restoreSafariSession } from '../../src/features/safari/model';
import { SINNOH_LOCATIONS, regionPortals } from '../../src/features/safari/regions';
import { encounterTable, honeyTreeTable, isBesideHoneyTree, isWalkable, rollEncounter, rustlingPatch, tileAt, zoneById } from '../../src/features/safari/zones';
import { hasShinySprite } from '../../src/shared/pokemon/sprites';
import { regionJourney, routePath } from '../fixtures/safari';

test('Sinnoh routes connect Twinleaf to all 16 locations and return through the same exits', () => {
  const start = createSafariSession('twinleaf-town');
  expect(SINNOH_LOCATIONS).toHaveLength(16);
  const journey = regionJourney(start.zoneId, start.position, 'acuity-lakefront');
  expect(journey.locations).toEqual(SINNOH_LOCATIONS.map(zone => zone.id).sort());
  for (const zone of SINNOH_LOCATIONS) {
    expect(tileAt(zone, zone.start), zone.id).toBe('.');
    for (const exit of regionPortals(zone.id)) {
      const destination = zoneById(exit.to);
      expect(tileAt(destination, exit.arrival), destination.id).toBe('.');
      expect(journey.seen.has(`${exit.to}:${exit.arrival.x},${exit.arrival.y}`)).toBe(true);
      expect(regionPortals(exit.to).some(back =>
        back.to === zone.id && Math.abs(back.x - exit.arrival.x) + Math.abs(back.y - exit.arrival.y) === 1,
      ), `${zone.id} → ${exit.to}`).toBe(true);
      const patch = rustlingPatch(destination, 0, exit.arrival);
      if (destination.species.length) {
        expect(patch, destination.id).not.toBeNull();
        expect(() => routePath(exit.to, exit.arrival, patch!)).not.toThrow();
      } else {
        expect(patch, destination.id).toBeNull();
      }
    }
  }
});

test('Sinnoh pools use canonical species, local music and bundled shiny sprites', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of SINNOH_LOCATIONS) {
      expect(areaTrack(zone.music), zone.id).toBeDefined();
      if (!zone.species.length) continue;
      expect(new Set(zone.species.map(species => species.id)).size).toBe(zone.species.length);
      expect(encounterTable(zone).totalWeight, zone.id).toBe(100);
      for (const species of zone.species) {
        const [name, generation, legendary, mythical] = db.exec(
          'SELECT name, generation_id, is_legendary, is_mythical FROM pokemon WHERE id = ?', [species.id],
        )[0].values[0];
        expect(name).toBe(species.name);
        expect(Number(generation)).toBeLessThanOrEqual(4);
        expect([legendary, mythical]).toEqual([0, 0]);
        expect(hasShinySprite(species.id), species.name).toBe(true);
      }
    }
  } finally {
    db.close();
  }
});

test('Sinnoh Honey Trees are reachable and use a separate weighted pool with local sprites', async () => {
  const areas = SINNOH_LOCATIONS.filter(zone => zone.honeyTree);
  expect(areas.map(zone => zone.id)).toEqual(['route-204', 'valley-windworks', 'eterna-forest']);
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of areas) {
      const tree = zone.honeyTree!;
      for (const y of [tree.y, tree.y + 1]) for (const x of [tree.x, tree.x + 1]) {
        expect(isWalkable(zone, { x, y }), zone.id).toBe(false);
      }
      const journey = regionJourney(zone.id, zone.start, zone.id);
      const approaches = [...journey.seen].filter(key => key.startsWith(`${zone.id}:`)).map(key => {
        const [x, y] = key.split(':')[1].split(',').map(Number);
        return { x, y };
      });
      expect(approaches.some(position => isBesideHoneyTree(tree, position)), zone.id).toBe(true);
      const pool = honeyTreeTable(tree);
      expect(pool.totalWeight).toBe(100);
      expect(rollEncounter(pool, .999).name).toBe('Munchlax');
      expect(pool.rows.find(row => row.pokemon.id === 446)?.chance).toBe(.01);
      for (const { pokemon } of pool.rows) {
        expect(db.exec('SELECT name FROM pokemon WHERE id = ?', [pokemon.id])[0].values[0]).toEqual([pokemon.name]);
        expect(hasShinySprite(pokemon.id)).toBe(true);
      }
      expect(encounterTable(zone).rows.some(row => row.pokemon.id === 412)).toBe(false);
    }
  } finally {
    db.close();
  }
});

test('checking a Honey Tree requires standing beside it and preserves a catch across reload', async () => {
  const start = createSafariSession('eterna-forest');
  expect(checkHoneyTree(start, 0, 'too-far')).toBe(start);
  const nextToTree = { ...start, position: { x: 9, y: 8 }, bag: { ...createBag(), repelSteps: 20 } };
  const active = checkHoneyTree(nextToTree, 0, 'honey-first', { shinyRoll: 0, fleeAfter: 5 });
  expect(active).toMatchObject({ steps: 0, position: nextToTree.position, bag: { repelSteps: 20 },
    encounter: { pokemonId: 412, source: 'honey-tree', shiny: true, fleeAfter: 5, attempts: 0 } });
  expect(checkHoneyTree(active, .999, 'duplicate')).toBe(active);
  expect(restoreSafariSession(JSON.parse(JSON.stringify(active)))).toEqual(active);
  expect(restoreSafariSession({ ...active, encounter: { ...active.encounter, source: undefined } })).toBeNull();
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const reply = checkSafariQuery(db, 'SELECT * FROM pokedex WHERE id = 412', 412, 'field-notes');
    const caught = recordSafariReply(active, 'honey-first', reply, '2026-11-26T12:00:00.000Z');
    expect(caught.encounter?.outcome).toBe('caught');
    expect(restoreSafariSession(JSON.parse(JSON.stringify({ ...caught, encounter: null })))).toMatchObject({
      lastCatch: { pokemon: { id: 412 } }, catches: 1,
    });
  } finally {
    db.close();
  }
});
