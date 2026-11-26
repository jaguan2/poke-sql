import { test, expect } from '@playwright/test';
import { UNOVA_LOCATIONS } from '../../src/features/safari/regions';
import { zoneById } from '../../src/features/safari/zones';
import { hasShinySprite } from '../../src/shared/pokemon/sprites';
import { regionJourney } from '../fixtures/safari';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import catalog from '../../src/features/safari/unova-species.json' with { type: 'json' };
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { createSafariSession, changeSafariRegion, restoreSafariSession, isSafariSession } from '../../src/features/safari/model';

test('Unova is connected and pools include exclusives from both games', () => {
  const origin = zoneById('nuvema-town');
  expect(regionJourney(origin.id, origin.start, 'nimbasa-city').locations).toEqual(UNOVA_LOCATIONS.map(zone => zone.id).sort());
  for (const [id, exclusives] of [['pinwheel-forest', ['Cottonee', 'Petilil']], ['unova-route-5', ['Gothita', 'Solosis']]] as const) {
    expect(zoneById(id).species.map(species => species.name)).toEqual(expect.arrayContaining([...exclusives]));
  }
  for (const zone of UNOVA_LOCATIONS.filter(zone => zone.species.length)) {
    expect(zone.species.reduce((sum, species) => sum + species.weight, 0)).toBe(100);
    expect(zone.species.every(species => hasShinySprite(species.id))).toBe(true);
  }
});

test('every one of the 156 native Unova species has a catch route and complete local sprites', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const original = db.exec('SELECT id, name FROM pokemon WHERE generation_id = 5 ORDER BY id')[0].values;
    expect(original).toHaveLength(156);
    expect(catalog.map(species => [species.id, species.name])).toEqual(original);
    const available = new Map(UNOVA_LOCATIONS.flatMap(zone => zone.species.map(species => [species.id, species] as const)));
    for (const species of catalog) {
      expect(available.get(species.id)?.name, species.name).toBe(species.name);
      expect(hasShinySprite(species.id), species.name).toBe(true);
      expect(checkSafariQuery(db, `SELECT * FROM pokedex WHERE id = ${species.id}`, species.id, 'field-notes').passed).toBe(true);
      const image = readFileSync(`public/sprites/${species.id}.png`);
      const shiny = readFileSync(`public/sprites/shiny/${species.id}.png`);
      expect(shiny.subarray(16, 24).equals(image.subarray(16, 24)), species.name).toBe(true);
    }
  } finally { db.close(); }
});

test('rebuilt regional maps preserve legacy encounters, drafts and remote bookmarks', () => {
  const legacy = {
    ...createSafariSession('unova-route-3'), layoutRevision: undefined, position: { x: 5, y: 4 }, draft: 'SELECT name FROM pokedex',
    encounter: { id: 'before-redesign', pokemonId: 504, assignmentId: 'field-notes', attempts: 2, outcome: 'active', fleeAfter: 5 },
    regionPositions: { sinnoh: { zoneId: 'jubilife-city', position: { x: 5, y: 5 }, direction: 'up' } },
  };
  const restored = restoreSafariSession(legacy)!;
  expect(isSafariSession(restored)).toBe(true);
  expect(restored.position).toEqual(zoneById('unova-route-3').start);
  expect(restored.encounter).toEqual(legacy.encounter);
  expect(restored.draft).toBe(legacy.draft);
  expect(restored.regionPositions?.sinnoh?.position).toEqual(zoneById('jubilife-city').start);
  const remote = changeSafariRegion({ ...restored, encounter: null }, 'sinnoh');
  expect(remote.position).toEqual(zoneById('jubilife-city').start);
  expect(restoreSafariSession(JSON.parse(JSON.stringify(remote)))).toEqual(remote);
  expect(restoreSafariSession({ ...legacy, position: { x: 999, y: 999 } })).toBeNull();
});
