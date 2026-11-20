import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { changeSafariRegion, changeSafariZone, createSafariSession, isSafariSession, walkSafari } from '../../src/features/safari/model';
import { REGIONS, JOHTO_LOCATIONS, regionPortals } from '../../src/features/safari/regions';
import { encounterTable, isWalkable, movePosition, rustlingPatch, tileAt, zoneById } from '../../src/features/safari/zones';
import { hasShinySprite } from '../../src/shared/pokemon/sprites';
import { areaTrack } from '../../src/features/music/catalog';
import { regionJourney, routePath } from '../fixtures/safari';

test('all seventeen Johto locations connect New Bark Town to Goldenrod on foot', () => {
  const start = createSafariSession('new-bark-town');
  const journey = regionJourney(start.zoneId, start.position, 'goldenrod-city');
  expect(journey.locations).toEqual(['azalea-town', 'cherrygrove-city', 'goldenrod-city', 'ilex-forest', 'ilex-north-gate', 'ilex-south-gate', 'new-bark-town', 'route-29', 'route-30', 'route-31', 'route-32', 'route-33', 'route-34', 'slowpoke-well-b1f', 'union-cave-1f', 'violet-city', 'violet-gate']);
  for (const zone of JOHTO_LOCATIONS) {
    expect(isWalkable(zone, zone.start), zone.id).toBe(true);
    for (const exit of regionPortals(zone.id)) expect(journey.seen.has(`${exit.to}:${exit.arrival.x},${exit.arrival.y}`), zone.id).toBe(true);
  }
  expect(journey.path).toBeDefined();
  let session = start;
  for (const [index, direction] of journey.path!.entries()) {
    session = walkSafari(session, direction, 1, 0, `johto-${index}`);
    if (session.encounter) session = { ...session, encounter: null, draft: '', grassSteps: 0 };
  }
  expect(session).toMatchObject({ zoneId: 'goldenrod-city', catches: 0, encounter: null });
  expect(isSafariSession(session)).toBe(true);
});

test('area drops reach every region location without granting catches and never interrupt an encounter', () => {
  let session = { ...createSafariSession(), catches: 7, draft: '-- saved SQL' };
  for (const region of REGIONS) for (const zone of region.locations) {
    session = changeSafariZone(session, zone.id);
    expect(session).toMatchObject({ zoneId: zone.id, position: zone.start, catches: 7, draft: '-- saved SQL', encounter: null });
    expect(isSafariSession(session), zone.id).toBe(true);
  }
  const active = { ...createSafariSession('union-cave-1f'), encounter: { id: 'stay', pokemonId: 41, level: 12, assignmentId: 'field-notes' as const, attempts: 1, outcome: 'active' as const, fleeAfter: 8 as const } };
  for (const region of REGIONS) {
    expect(changeSafariRegion(active, region.id)).toBe(active);
    for (const zone of region.locations) expect(changeSafariZone(active, zone.id)).toBe(active);
  }
});

test('Crystal floor ledges allow side steps and jumping, while north walls block their edge', () => {
  const route = zoneById('route-32');
  expect(tileAt(route, { x: 6, y: 80 })).toBe('3');
  expect(movePosition(route, { x: 7, y: 80 }, 'left')).toEqual({ x: 6, y: 80 });
  expect(movePosition(route, { x: 6, y: 80 }, 'down')).toEqual({ x: 6, y: 82 });
  const approach = { ...createSafariSession('route-32'), position: { x: 6, y: 80 } };
  expect(walkSafari(approach, 'up', 1, 0, 'cave-entry')).toMatchObject({ zoneId: 'union-cave-1f', position: { x: 17, y: 3 }, catches: 0 });
  expect(tileAt(route, { x: 6, y: 76 })).toBe('U');
  expect(movePosition(route, { x: 6, y: 77 }, 'up')).toEqual({ x: 6, y: 76 });
  expect(movePosition(route, { x: 6, y: 76 }, 'up')).toEqual({ x: 6, y: 76 });
  expect(movePosition(route, { x: 6, y: 76 }, 'down')).toEqual({ x: 6, y: 77 });
});

test('Johto shaking patches remain reachable after cave entrances, gates and repeated catches', () => {
  expect(rustlingPatch(zoneById('route-32'), 0, { x: 0, y: 89 })).toBeNull();
  for (const zone of JOHTO_LOCATIONS.filter(zone => zone.species.length)) {
    expect(rustlingPatch(zone, 0, zone.start), zone.id).not.toBeNull();
    const arrivals = JOHTO_LOCATIONS.flatMap(from => regionPortals(from.id).filter(exit => exit.to === zone.id).map(exit => exit.arrival));
    for (const position of [zone.start, ...arrivals]) for (let catches = 0; catches < 6; catches++) {
      const patch = rustlingPatch(zone, catches, position);
      if (patch) expect(() => routePath(zone.id, position, patch), `${zone.id}, catch ${catches}`).not.toThrow();
    }
  }
});

test('Johto tables use canonical Gen I-II species, local shiny sprites and native area music', async () => {
  const SQL = await initSqlJs(); const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of JOHTO_LOCATIONS) {
      expect(areaTrack(zone.music)?.region).toBe('Johto');
      if (!zone.species.length) continue;
      expect(zone.species.reduce((sum, p) => sum + p.weight, 0), zone.id).toBe(100);
      expect(encounterTable(zone).rows.reduce((sum, p) => sum + p.chance, 0)).toBeCloseTo(1);
      for (const species of zone.species) {
        const [name, generation, legendary, mythical] = db.exec(`SELECT name, generation_id, is_legendary, is_mythical FROM pokemon WHERE id = ${species.id}`)[0].values[0];
        expect(name).toBe(species.name); expect(Number(generation)).toBeLessThanOrEqual(2);
        expect([legendary, mythical]).toEqual([0, 0]); expect(hasShinySprite(species.id)).toBe(true);
      }
    }
  } finally { db.close(); }
});
