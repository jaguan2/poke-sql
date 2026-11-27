import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { advancePlayer, canStand, createPlayer, traverse, type Player } from '../../src/features/safari/world/physics';
import { parseTerrain, type TerrainMap } from '../../src/features/safari/world/terrain';
import { spawnWild, canInteract, wanderWild } from '../../src/features/safari/world/wild';
import { createSafariSession, saveExploration, interactWithWild, recordSafariReply, restoreSafariSession, changeSafariZone } from '../../src/features/safari/model';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { zoneById } from '../../src/features/safari/zones';

const terrain = (rows: string[], id = 'test'): TerrainMap => ({ id, rows, width: rows[0].length, height: rows.length,
  elevation: rows.flatMap(row => [...row].map(t => t === '~' ? 1 : 3)), connections: [] });
const open = terrain(Array(60).fill('.'.repeat(60)));
function walk(player: Player, maps: Map<string, TerrainMap>, x: number, y: number, seconds: number, fps = 60, run = false) {
  for (let i = 0; i < Math.round(seconds * fps); i++) player = advancePlayer(player, { x, y, run, autoSurf: false }, 1 / fps, maps);
  return player;
}

test('continuous movement normalizes diagonals and integrates consistently at different frame rates', () => {
  const results = [17, 30, 60, 144].map(fps => walk(createPlayer(open, { x: 20, y: 20 }), new Map([['test', open]]), 1, 0, 2, fps));
  expect(Math.max(...results.map(p => p.position.x)) - Math.min(...results.map(p => p.position.x))).toBeLessThan(.005);
  const diagonal = walk(createPlayer(open, { x: 20, y: 20 }), new Map([['test', open]]), 1, 1, 2);
  expect(Math.hypot(diagonal.position.x - 20, diagonal.position.y - 20)).toBeCloseTo(results[0].position.x - 20, 3);
  const run = walk(createPlayer(open, { x: 20, y: 20 }), new Map([['test', open]]), 1, 0, 2, 60, true);
  expect((run.position.x - 20) / (results[0].position.x - 20)).toBeCloseTo(5 / 3, 3);
});

test('feet hitbox blocks diagonal corner cutting, slides along walls and respects elevation', () => {
  const corner = terrain(['.....', '..#..', '.#...', '.....', '.....']);
  const p = walk(createPlayer(corner, { x: 1, y: 1 }), new Map([['test', corner]]), 1, 1, 2);
  expect(p.position.x).toBeLessThan(1.3); expect(p.position.y).toBeLessThan(1.3);
  const wall = terrain(Array(8).fill('..#.....'));
  const slid = walk(createPlayer(wall, { x: 1, y: 1 }), new Map([['test', wall]]), 1, 1, 1);
  expect(slid.position.x).toBeLessThan(1.3); expect(slid.position.y).toBeGreaterThan(2.8);
  wall.elevation[1 * 8 + 1] = 7;
  expect(canStand(new Map([['test', wall]]), 'test', { x: 1, y: 1 }, 'walking', 3)).toBe(false);
});

test('connected maps retain fractional coordinates, direction and surfing across a water boundary', () => {
  const a = terrain(Array(6).fill('~~~~~~'), 'a'), b = terrain(Array(6).fill('~~~~~~'), 'b');
  a.connections = [{ direction: 'right', offset: 1, runtimeDestination: 'b' }];
  b.connections = [{ direction: 'left', offset: -1, runtimeDestination: 'a' }];
  const p = walk(createPlayer(a, { x: 5, y: 3 }, 'surfing'), new Map([['a', a], ['b', b]]), 1, 0, .5);
  expect(p.mapId).toBe('b'); expect(p.mode).toBe('surfing'); expect(p.position.y).toBeCloseTo(2);
  expect(p.position.x).toBeGreaterThan(.8); expect(p.position.x).toBeLessThan(1.1); expect(p.direction).toBe('right');
});

test('Surf validates shorelines, locks transitions, stops at rocks, and supports separate bridge planes', () => {
  const map = terrain(Array(5).fill('..~~~#..')), maps = new Map([['test', map]]);
  const land = createPlayer(map, { x: 1, y: 2 }, 'walking', 'right');
  expect(walk(land, maps, 1, 0, 1).position.x).toBeLessThan(1.3);
  const mount = traverse(land, maps); expect(mount.transition).toBeDefined(); expect(traverse(mount, maps)).toBe(mount);
  let surf = walk(mount, maps, 0, 0, .3); expect(surf.mode).toBe('surfing');
  const blocked = walk(surf, maps, 1, 0, 2); expect(blocked.position.x).toBeLessThan(4.3);
  surf = { ...surf, direction: 'left' };
  const landed = walk(traverse(surf, maps), maps, 0, 0, .3); expect(landed.mode).toBe('walking');
  const bridge = terrain(['~~~', '~B~', '~~~']); bridge.elevation[4] = 3;
  expect(canStand(new Map([['test', bridge]]), 'test', { x: 1, y: 1 }, 'walking', 3)).toBe(true);
  expect(canStand(new Map([['test', bridge]]), 'test', { x: 1, y: 1 }, 'surfing', 1)).toBe(true);
  expect(traverse(createPlayer(map, { x: 4, y: 2 }, 'surfing', 'right'), maps).transition).toBeUndefined();
});

test('native directional ledges jump only in their permitted direction', () => {
  const map = terrain(['.....', '.....', 'vvvvv', '.....', '.....']), maps = new Map([['test', map]]);
  const jumped = walk(createPlayer(map, { x: 2, y: 1 }), maps, 0, 1, .4);
  expect(jumped.position.y).toBeGreaterThanOrEqual(3);
  const blocked = walk(createPlayer(map, { x: 2, y: 3 }), maps, 0, -1, .5);
  expect(blocked.position.y).toBeGreaterThan(2.7);
});

test('automatic Surf uses validated shorelines and rejects elevated land', () => {
  const map = terrain(Array(5).fill('..~~~~')), maps = new Map([['test', map]]);
  let player = createPlayer(map, { x: 1, y: 2 }, 'walking', 'right');
  for (let i = 0; i < 30; i++) player = advancePlayer(player, { x: 1, y: 0, run: false, autoSurf: true }, 1 / 60, maps);
  expect(player.mode).toBe('surfing');
  map.elevation[2 * map.width + 1] = 7;
  expect(traverse(createPlayer(map, { x: 2, y: 2 }, 'surfing', 'left'), maps).transition).toBeUndefined();
  expect(traverse(createPlayer(map, { x: 1, y: 2 }, 'walking', 'right'), maps).transition).toBeUndefined();
});

test('continuous saves reject stale navigation updates and restore invalid additions without losing progress', () => {
  const snapshot = { enabled: true, mapId: 'pallet-town', x: 6.2, y: 8, mode: 'walking' as const, direction: 'right' as const, autoSurf: true, generation: 0 };
  const session = saveExploration(createSafariSession(), snapshot, 2);
  expect(session.steps).toBe(2);
  expect(saveExploration(session, { ...snapshot, x: Number.NaN }, 1)).toBe(session);
  expect(saveExploration(session, snapshot, -1)).toBe(session);
  const traveled = changeSafariZone(session, 'route-1');
  expect(saveExploration(traveled, snapshot, 1)).toBe(traveled);
  const classic = { ...session, exploration: { ...snapshot, enabled: false, generation: 1 } };
  expect(saveExploration(classic, snapshot, 1)).toBe(classic);
  const restored = restoreSafariSession({ ...session, exploration: { ...snapshot, x: 99999 } });
  expect(restored.steps).toBe(2); expect(restored.exploration).toBeUndefined();
  const data = JSON.parse(readFileSync('public/safari/worlds/kanto/pallet-town.world.json', 'utf8'));
  expect(() => parseTerrain({ ...data, terrain: { version: 1, rows: ['bad'] } }, 'pallet-town', data.width, data.height)).toThrow('Invalid overworld terrain');
});

test('visible Pokémon spawn in reachable habitat, wander within it and cannot interact through walls', () => {
  const data = JSON.parse(readFileSync('public/safari/worlds/kanto/route-1.world.json', 'utf8'));
  const map = parseTerrain(data, 'route-1', data.width, data.height), zone = zoneById('route-1');
  const p = createPlayer(map, zone.rustle);
  const wild = spawnWild(map, zone, p, 'fixed', '2026-11-27'); expect(wild.length).toBeGreaterThan(0); expect(wild.length).toBeLessThanOrEqual(3);
  expect(spawnWild(map, zone, p, 'fixed', '2026-11-27')).toEqual(wild);
  for (const entity of wild) {
    for (let t = 0; t < 600; t++) wanderWild(entity, map, t / 60, 1 / 60);
    expect(map.rows[Math.floor(entity.position.y + .5)][Math.floor(entity.position.x + .5)]).toBe('g');
  }
  const barrier = terrain(['.....', '..#..', '.....']);
  expect(canInteract(createPlayer(barrier, { x: 1.3, y: 1 }), { ...wild[0], position: { x: 2.7, y: 1 }, aquatic: false }, barrier)).toBe(false);
});

test('visible encounters reuse canonical SQL grading, allow unlimited retries and retain capture across reload', async () => {
  const SQL = await initSqlJs(), db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    let session = saveExploration(createSafariSession('route-1'), { enabled: true, mapId: 'route-1', x: 12, y: 38, mode: 'walking', direction: 'up', autoSurf: false }, 0);
    session = interactWithWild(session, 16, 'wild:route-1:test:0', false, { trainerDays: 0, shinyRoll: 1 });
    expect(session.encounter?.fleeAfter).toBeNull();
    for (let i = 0; i < 10; i++) session = recordSafariReply(session, session.encounter!.id, { passed: false }, '2026-11-27T12:00:00.000Z');
    expect(session.encounter?.outcome).toBe('active');
    const reply = checkSafariQuery(db, 'SELECT * FROM pokedex WHERE id IN (SELECT id FROM pokemon WHERE id=16)', 16, 'field-notes');
    const caught = recordSafariReply(session, session.encounter!.id, reply, '2026-11-27T12:00:00.000Z');
    expect(caught.catches).toBe(1); expect(restoreSafariSession(JSON.parse(JSON.stringify(caught)))).toEqual(caught);
    expect(recordSafariReply(caught, caught.encounter!.id, reply, '2026-11-27T12:00:00.000Z')).toBe(caught);
  } finally { db.close(); }
});
