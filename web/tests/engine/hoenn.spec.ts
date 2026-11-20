import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { changeSafariRegion, createSafariSession, isSafariSession, restoreSafariSession, walkSafari } from '../../src/features/safari/model';
import { HOENN_LOCATIONS, regionPortals } from '../../src/features/safari/regions';
import { chooseSpecies, encounterTable, isWalkable, zoneById } from '../../src/features/safari/zones';
import { areaTrack } from '../../src/features/music/catalog';
import { regionJourney, nearSafariGrass } from '../fixtures/safari';

test('all fourteen Hoenn maps form a walkable journey from Littleroot to Mauville', () => {
  const initial = changeSafariRegion(createSafariSession(), 'hoenn');
  expect(initial).toMatchObject({ zoneId: 'littleroot-town', position: { x: 10, y: 12 }, catches: 0 });
  const journey = regionJourney(initial.zoneId, initial.position, 'mauville-city');
  expect(journey.locations).toEqual(['littleroot-town', 'mauville-city', 'oldale-town', 'petalburg-city', 'petalburg-woods', 'route-101', 'route-102', 'route-103', 'route-104', 'route-116', 'route-117', 'rustboro-city', 'rusturf-tunnel', 'verdanturf-town']);
  for (const zone of HOENN_LOCATIONS) {
    expect(isWalkable(zone, zone.start), zone.id).toBe(true);
    for (const portal of regionPortals(zone.id)) expect(journey.seen.has(`${portal.to}:${portal.arrival.x},${portal.arrival.y}`), `${zone.id} → ${portal.to}`).toBe(true);
  }
  expect(journey.path).toBeDefined();
  let session = initial;
  for (const [step, direction] of journey.path!.entries()) {
    session = walkSafari(session, direction, 1, 0, `journey-${step}`);
    if (session.encounter) session = { ...session, encounter: null, draft: '', grassSteps: 0 };
  }
  expect(session.zoneId).toBe('mauville-city');
  expect(session.catches).toBe(0);
  expect(isSafariSession(session)).toBe(true);
});

test('region switching preserves both positions, visited places, catch totals and legacy saves', () => {
  const kanto = { ...createSafariSession('route-1'), catches: 7, draft: '-- saved draft' };
  let hoenn = changeSafariRegion(kanto, 'hoenn');
  hoenn = walkSafari(hoenn, 'right', 0, 0, 'town-step');
  expect(hoenn.position).toEqual({ x: 11, y: 12 });
  const returned = changeSafariRegion(hoenn, 'kanto');
  expect(returned).toMatchObject({ zoneId: 'route-1', position: kanto.position, catches: 7, draft: '-- saved draft' });
  const restored = restoreSafariSession(JSON.parse(JSON.stringify(returned)))!;
  expect(changeSafariRegion(restored, 'hoenn')).toMatchObject({ zoneId: 'littleroot-town', position: { x: 11, y: 12 }, direction: 'right', catches: 7 });
  const active = walkSafari(nearSafariGrass('rusturf-tunnel'), 'left', 0, 0, 'active');
  expect(active.encounter?.pokemonId).toBe(293);
  expect(changeSafariRegion(active, 'kanto')).toBe(active);
  expect(restoreSafariSession({ ...returned, regionPositions: { hoenn: { zoneId: 'pallet-town', position: { x: 6, y: 8 }, direction: 'up' } } })).toBeNull();
  const { regionPositions: _, ...older } = kanto;
  expect(restoreSafariSession(older)).toEqual(older);
});

test('Rusturf Tunnel keeps its Whismur-only pool available after a Whismur catch', () => {
  const tunnel = zoneById('rusturf-tunnel');
  expect(encounterTable(tunnel, 'clear', 293).rows.map(row => [row.pokemon.name, row.chance])).toEqual([['Whismur', 1]]);
  expect(chooseSpecies(tunnel, .99, 293).id).toBe(293);
});

test('Hoenn pools use canonical pre-Generation-IV species and each map has its native music', async () => {
  const SQL = await initSqlJs(); const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    for (const zone of HOENN_LOCATIONS) {
      expect(areaTrack(zone.music)?.file, zone.name).toMatch(/^hoenn\//);
      if (zone.species.length) expect(zone.species.reduce((sum, p) => sum + p.weight, 0)).toBe(100);
      for (const p of zone.species) {
        const row = db.exec('SELECT name, generation_id, is_legendary, is_mythical FROM pokemon WHERE id=?', [p.id])[0].values[0];
        expect(row[0]).toBe(p.name); expect(Number(row[1])).toBeLessThanOrEqual(3); expect(row.slice(2)).toEqual([0, 0]);
      }
    }
  } finally { db.close(); }
});
