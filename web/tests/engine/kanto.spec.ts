import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { createSafariSession, changeSafariZone, isSafariSession, restoreSafariSession, visitedLocations, walkSafari } from '../../src/features/safari/model';
import { KANTO_LOCATIONS, regionPortals } from '../../src/features/safari/regions';
import { isWalkable, zoneById, type ZoneId } from '../../src/features/safari/zones';
import { nearSafariGrass, regionJourney } from '../fixtures/safari';

test('the complete first Kanto journey is walkable, including gates, ledges and all Mt. Moon chambers', () => {
  const start = createSafariSession();
  expect(start).toMatchObject({ zoneId: 'pallet-town', position: { x: 6, y: 8 }, encounter: null });
  const journey = regionJourney(start.zoneId, start.position, 'cerulean-city');
  expect(journey.locations).toEqual([
    'cerulean-city', 'forest-north-gate', 'forest-south-gate', 'mt-moon-1f', 'mt-moon-b1f', 'mt-moon-b2f',
    'pallet-town', 'pewter-city', 'route-1', 'route-2', 'route-22', 'route-3', 'route-4', 'viridian-city', 'viridian-forest',
  ]);
  for (const zone of KANTO_LOCATIONS) {
    expect(isWalkable(zone, zone.start), zone.id).toBe(true);
    for (const portal of regionPortals(zone.id)) expect(journey.seen.has(`${portal.to}:${portal.arrival.x},${portal.arrival.y}`), `${zone.id} → ${portal.to}`).toBe(true);
  }
  expect(journey.path).toBeDefined();
  let session = start;
  for (const [step, direction] of journey.path!.entries()) {
    session = walkSafari(session, direction, 1, 0, `walk-${step}`);
    // Leaving a battle is always allowed; the trainer resumes on the same tile.
    if (session.encounter) session = { ...session, encounter: null, draft: '', grassSteps: 0 };
  }
  expect(session.zoneId).toBe('cerulean-city');
  expect(visitedLocations(session)).toEqual(expect.arrayContaining(['pallet-town', 'viridian-city', 'pewter-city', 'viridian-forest', 'mt-moon-1f', 'mt-moon-b1f', 'mt-moon-b2f', 'cerulean-city']));
  expect(session.catches).toBe(0);
  expect(isSafariSession(session)).toBe(true);
});

test('safe town walking cannot create an encounter and travel can reach unvisited towns or routes', () => {
  const session = createSafariSession();
  expect(walkSafari(session, 'up', 0, 0, 'closed-house')).toMatchObject({ position: { x: 6, y: 8 }, steps: 0 });
  expect(changeSafariZone(session, 'cerulean-city')).toMatchObject({ zoneId: 'cerulean-city', catches: 0, encounter: null });
  let walking = session;
  for (let i = 0; i < 30; i++) walking = walkSafari(walking, i % 2 ? 'left' : 'right', 0, 0, `safe-${i}`);
  expect(walking.zoneId).toBe('pallet-town');
  expect(walking.encounter).toBeNull();
  expect(walking.grassSteps).toBe(0);
  const visited = { ...session, zoneId: 'route-1' as const, position: zoneById('route-1').start, visited: ['pallet-town', 'viridian-city', 'route-1'] as ZoneId[] };
  expect(changeSafariZone(visited, 'viridian-city')).toMatchObject({ zoneId: 'viridian-city', catches: 0, visited: ['pallet-town', 'viridian-city', 'route-1'] });
  const city = changeSafariZone(visited, 'viridian-city');
  expect(changeSafariZone(city, 'route-1')).toMatchObject({ zoneId: 'route-1', catches: 0, encounter: null });
});

test('old Safari saves keep their habitat, active assignment, attempts, shiny state and SQL draft', () => {
  const active = walkSafari(nearSafariGrass(), 'left', 0, 0, 'legacy-active', { fleeAfter: 8, shinyRoll: 0 });
  const { visited: _, ...old } = { ...active, draft: 'SELECT name FROM pokedex', encounter: { ...active.encounter!, attempts: 3 } };
  const restored = restoreSafariSession(JSON.parse(JSON.stringify(old)));
  expect(restored).toEqual(old);
  expect(changeSafariZone(restored!, 'pallet-town')).toBe(restored);
  expect(walkSafari(restored!, 'up', 0, 0, 'new')).toBe(restored);
  expect(restoreSafariSession({ ...old, visited: ['missing-town'] })).toBeNull();
});

test('Kanto encounter tables contain canonical Generation I species, with no ordinary legendary rolls', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const location of KANTO_LOCATIONS) {
      if (!location.species.length) continue;
      expect(location.species.reduce((sum, species) => sum + species.weight, 0), location.name).toBe(100);
      for (const species of location.species) {
        expect(db.exec('SELECT name, generation_id, is_legendary, is_mythical FROM pokemon WHERE id = ?', [species.id])[0].values[0]).toEqual([species.name, 1, 0, 0]);
      }
    }
  } finally { db.close(); }
});
