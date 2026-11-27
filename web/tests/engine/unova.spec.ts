import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'node:fs';
import { REGIONS } from '../../src/features/safari/regions';
import { zoneById } from '../../src/features/safari/zones';
import { createSafariSession, restoreSafariSession } from '../../src/features/safari/model';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { hasShinySprite } from '../../src/shared/pokemon/sprites';
import { entriesFor } from '../fixtures/pokemon-encounters';
import catalog from '../../src/features/safari/unova-species.json' with { type: 'json' };

test('Unova world assets are retired while all 156 Pokémon and their local sprites remain', async () => {
  expect(REGIONS.map(region => region.id)).toEqual(['kanto', 'hoenn', 'johto', 'sinnoh']);
  expect(existsSync('public/safari/unova')).toBe(false);
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    expect(db.exec('SELECT COUNT(*) FROM pokemon')[0].values[0][0]).toBe(1025);
    const original = db.exec('SELECT id, name FROM pokemon WHERE generation_id = 5 ORDER BY id')[0].values;
    expect(original).toHaveLength(156);
    expect(catalog.map(species => [species.id, species.name])).toEqual(original);
    for (const species of catalog) {
      expect(hasShinySprite(species.id), species.name).toBe(true);
      expect(checkSafariQuery(db, `SELECT * FROM pokedex WHERE id = ${species.id}`, species.id, 'field-notes').passed).toBe(true);
      const image = readFileSync(`public/sprites/${species.id}.png`);
      const shiny = readFileSync(`public/sprites/shiny/${species.id}.png`);
      expect(shiny.subarray(16, 24).equals(image.subarray(16, 24)), species.name).toBe(true);
    }
  } finally { db.close(); }
});

test('an expedition in retired Unova returns home with progress and an intact archived task', async () => {
  const [caught] = await entriesFor([495]);
  const legacy = { ...createSafariSession(), zoneId: 'unova-route-3', position: { x: 5, y: 4 },
    steps: 71, catches: 1, draft: 'SELECT name FROM pokedex', bag: { repelSteps: 42, charmEnabled: true },
    encounter: { id: 'before-retirement', pokemonId: 504, assignmentId: 'field-notes', attempts: 2, outcome: 'active', fleeAfter: 5 },
    lastCatch: { encounterId: 'unova-catch', pokemon: caught.pokemon, attempts: 1, caughtAt: '2026-11-26T12:00:00.000Z' },
    visited: ['pallet-town', 'nuvema-town', 'unova-route-3'],
    regionPositions: { unova: { zoneId: 'nuvema-town', position: { x: 12, y: 9 }, direction: 'up' },
      sinnoh: { zoneId: 'jubilife-city', position: zoneById('jubilife-city').start, direction: 'up', layoutRevision: zoneById('jubilife-city').layoutRevision } },
  };
  const restored = restoreSafariSession(legacy)!;
  expect(restored).toMatchObject({ zoneId: 'pallet-town', position: zoneById('pallet-town').start,
    steps: 71, catches: 1, draft: legacy.draft, encounter: null, lastCatch: legacy.lastCatch, bag: legacy.bag,
    visited: ['pallet-town'], retiredUnova: legacy, regionPositions: { sinnoh: legacy.regionPositions.sinnoh } });
  expect(restored.regionPositions).not.toHaveProperty('unova');
  expect(restoreSafariSession(JSON.parse(JSON.stringify(restored)))).toEqual(restored);
  expect(legacy.zoneId).toBe('unova-route-3');
});

test('retired visits and bookmarks do not discard an active task in a remaining habitat', () => {
  const active = { ...createSafariSession('forest'),
    encounter: { id: 'forest-task', pokemonId: 10, assignmentId: 'field-notes', attempts: 2, outcome: 'active', fleeAfter: 5 },
    draft: 'SELECT * FROM pokedex WHERE id = 10;', visited: ['forest', 'nimbasa-city'],
    regionPositions: { unova: { zoneId: 'nimbasa-city', position: { x: 12, y: 9 }, direction: 'up' } },
  };
  expect(restoreSafariSession(active)).toMatchObject({ zoneId: 'forest', position: active.position,
    encounter: active.encounter, draft: active.draft, visited: ['forest'], regionPositions: {}, retiredUnova: active });
  expect(restoreSafariSession({ ...active, visited: ['forest', 'unknown-location'] })).toBeNull();
});
