import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { SAFARI_EVENT_VISITORS, safariEvents } from '../../src/features/safari/events';
import { chooseSpecies, encounterTable, SAFARI_ZONES, zoneById } from '../../src/features/safari/zones';
import { recordSafariReply, restoreSafariSession, walkSafari } from '../../src/features/safari/model';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { nearSafariGrass } from '../fixtures/safari';

test('special visitors match the database classifications and are excluded from ordinary pools', async () => {
  const SQL = await initSqlJs();
  const database = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    expect(SAFARI_EVENT_VISITORS).toHaveLength(15);
    for (const zone of SAFARI_ZONES) {
      for (const pokemon of zone.species) {
        const row = database.exec('SELECT name, is_legendary, is_mythical FROM pokemon WHERE id=?', [pokemon.id])[0].values[0];
        expect(row[0]).toBe(pokemon.name);
        expect(pokemon.rarity === 'Legendary').toBe(row[1] === 1);
        expect(pokemon.rarity === 'Mythical').toBe(row[2] === 1);
        expect(pokemon.weight === 0).toBe(row[1] === 1 || row[2] === 1);
      }
      expect(encounterTable(zone, 'rain').rows.every(row => row.pokemon.weight > 0)).toBe(true);
    }
  } finally { database.close(); }
});

test('weekend and monthly windows rotate in UTC with exclusive end dates', () => {
  expect(safariEvents('2026-01-02').map(event => ({
    name: event.visitor.name, active: event.active, starts: event.startsOn, ends: event.endsOn, chance: event.chance,
  }))).toEqual([
    { name: 'Virizion', active: true, starts: '2026-01-02', ends: '2026-01-05', chance: 0.01 },
    { name: 'Celebi', active: true, starts: '2026-01-01', ends: '2026-01-08', chance: 0.0025 },
  ]);
  expect(safariEvents('2026-01-01').map(event => event.active)).toEqual([false, true]);
  expect(safariEvents('2026-01-04').map(event => event.active)).toEqual([true, true]);
  expect(safariEvents('2026-01-05').map(event => event.active)).toEqual([false, true]);
  expect(safariEvents('2026-01-08').map(event => event.active)).toEqual([false, false]);
  expect(safariEvents('2026-01-09')[0].visitor.name).toBe('Suicune');
  expect(safariEvents('2026-02-01')[1]).toMatchObject({ visitor: { name: 'Shaymin', zoneId: 'meadow' }, active: true });
  expect(safariEvents('2026-12-31')[1]).toMatchObject({ startsOn: '2027-01-01', endsOn: '2027-01-08', active: false });
  expect(safariEvents('2028-02-29')[1]).toMatchObject({ startsOn: '2028-03-01' });
  for (const date of ['invalid', '2026-02-29', '2026-13-01']) expect(() => safariEvents(date)).toThrow(/valid UTC date/);
});

test('weather and last-catch exclusion preserve the exact event odds and total probability', () => {
  const forest = zoneById('forest');
  for (const weather of ['clear', 'rain', 'sun'] as const) {
    for (const previous of [undefined, 10, 640, 251]) {
      const { rows } = encounterTable(forest, weather, previous, '2026-01-02');
      expect(rows.reduce((sum, row) => sum + row.chance, 0)).toBeCloseTo(1, 12);
      expect(rows.find(row => row.pokemon.id === 640)?.chance ?? 0).toBeCloseTo(previous === 640 ? 0 : 0.01, 12);
      expect(rows.find(row => row.pokemon.id === 251)?.chance ?? 0).toBeCloseTo(previous === 251 ? 0 : 0.0025, 12);
      expect(rows.some(row => row.pokemon.id === previous)).toBe(false);
    }
  }
  expect(encounterTable(forest, 'clear', undefined, '2026-01-08').rows.some(row => row.pokemon.weight === 0)).toBe(false);
  expect(encounterTable(zoneById('coast'), 'rain', undefined, '2026-01-02').rows.some(row => row.pokemon.weight === 0)).toBe(false);
});

test('actual rolls select event visitors only in their habitat and active window', () => {
  const forest = zoneById('forest');
  expect(chooseSpecies(forest, 0.99, undefined, 'clear', '2026-01-02').name).toBe('Virizion');
  expect(chooseSpecies(forest, 0.999, undefined, 'clear', '2026-01-02').name).toBe('Celebi');
  expect(chooseSpecies(forest, 0.999, undefined, 'clear', '2026-01-08').name).toBe('Pikachu');
  expect(chooseSpecies(forest, 0.999, 251, 'clear', '2026-01-02').name).toBe('Virizion');
  // Shaking grass guarantees an encounter, while the same table sets its species.
  const encounter = walkSafari(nearSafariGrass(), 'left', 1, 0.99, 'weekend', { weather: 'clear', fleeAfter: 8, date: '2026-01-02' });
  expect(encounter.encounter).toMatchObject({ pokemonId: 640, outcome: 'active' });
});

test('an event encounter remains restorable and catchable after its window closes', async () => {
  const SQL = await initSqlJs();
  const database = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const active = walkSafari(nearSafariGrass(), 'left', 1, 0.999, 'celebi', { weather: 'clear', fleeAfter: 8, date: '2026-01-02' });
    const restored = restoreSafariSession(JSON.parse(JSON.stringify(active)))!;
    expect(restored.encounter).toMatchObject({ pokemonId: 251, outcome: 'active' });
    database.run('PRAGMA query_only=ON');
    const reply = checkSafariQuery(database, 'SELECT id, name, type1, type2 FROM pokedex WHERE id=251;', 251, 'field-notes');
    expect(reply.passed).toBe(true);
    const caught = recordSafariReply(restored, 'celebi', reply, '2026-01-08T12:00:00.000Z');
    expect(caught.catches).toBe(1);
    expect(caught.lastCatch?.pokemon.name).toBe('Celebi');
    expect(restoreSafariSession(JSON.parse(JSON.stringify(caught)))?.encounter?.outcome).toBe('caught');
  } finally { database.close(); }
});
