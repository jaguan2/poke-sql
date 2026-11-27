import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { parseTerrain, surface, tilePoint } from '../../src/features/safari/world/terrain';
import { createPlayer, canStand } from '../../src/features/safari/world/physics';
import { spawnWild, wanderWild } from '../../src/features/safari/world/wild';
import { createSafariSession, saveExploration, interactWithWild, restoreSafariSession, recordSafariReply } from '../../src/features/safari/model';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { zoneById } from '../../src/features/safari/zones';

test('real Route 103 water spawns stay on water and their SQL capture survives session restore', async () => {
  const data = JSON.parse(readFileSync('public/safari/worlds/hoenn/route-103.world.json', 'utf8'));
  const map = parseTerrain(data, 'route-103', data.width, data.height), maps = new Map([[map.id, map]]);
  const player = createPlayer(map, { x: 23, y: 9 }, 'surfing');
  const entities = spawnWild(map, zoneById('route-103'), player, 'water-contract', '2026-11-27');
  expect(entities.length).toBeGreaterThan(0);
  for (const entity of entities) {
    expect(entity.aquatic).toBe(true);
    for (let i = 0; i < 600; i++) wanderWild(entity, map, i / 60, 1 / 60);
    expect(surface(map, tilePoint(entity.position), 'surf').allowed).toBe(true);
    expect(canStand(maps, map.id, entity.position, 'surfing', entity.elevation)).toBe(true);
  }
  const target = entities[0];
  let session = saveExploration(createSafariSession('route-103'), { enabled: true, mapId: map.id, x: 23, y: 9, mode: 'surfing', direction: 'right', autoSurf: true }, 2);
  session = interactWithWild(session, target.pokemonId, target.id, true, { trainerDays: 0, shinyRoll: 1 });
  expect(session.encounter?.source).toBe('overworld-water');
  expect(restoreSafariSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  const SQL = await initSqlJs(), db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const reply = checkSafariQuery(db, `SELECT * FROM pokedex WHERE id=${target.pokemonId}`, target.pokemonId, session.encounter!.assignmentId);
    expect(reply.passed).toBe(true);
    session = recordSafariReply(session, target.id, reply, '2026-11-27T12:00:00.000Z');
    expect(session.catches).toBe(1); expect(session.exploration?.mode).toBe('surfing');
    expect(restoreSafariSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  } finally { db.close(); }
});
