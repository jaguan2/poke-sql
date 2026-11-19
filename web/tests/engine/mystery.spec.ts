import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { compareMysteryPokemon, isMysteryRound, MYSTERY_HISTORY_LIMIT, mysterySolved, pickMysteryTarget, recordMysteryGuess, runMysteryQuery } from '../../src/features/mystery/model';
import type { PokemonProfile } from '../../src/shared/pokemon/profile';

test('mystery clues compare canonical traits and win only for the exact species', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only = ON');
    const near = runMysteryQuery(db, 'SELECT id, name FROM pokedex WHERE id = 5', 6);
    expect(near.mysteryGuess).toMatchObject({
      matched: false, pokemon: { id: 5, name: 'Charmeleon', heightM: 1.1 },
      type1: 'correct', type2: 'wrong', generation: 'correct', height: 'higher', weight: 'higher',
    });
    const found = runMysteryQuery(db, 'WITH answer AS (SELECT * FROM pokedex) SELECT id FROM answer WHERE id = 6', 6);
    expect(found.mysteryGuess).toMatchObject({ matched: true, type1: 'correct', type2: 'correct', generation: 'correct', height: 'correct', weight: 'correct' });
    expect(runMysteryQuery(db, "SELECT 'pikachu' AS name", 25).mysteryGuess?.matched).toBe(true);
    const fabricated = runMysteryQuery(db, "SELECT id, 'water' AS type1, 100 AS height_m FROM pokedex WHERE id = 5", 6);
    expect(fabricated.mysteryGuess?.pokemon).toMatchObject({ id: 5, type1: 'fire', heightM: 1.1 });

    // Plusle and Minun share every displayed trait. Matching green tiles do
    // not accidentally award the other species as the correct answer.
    const twins = runMysteryQuery(db, 'SELECT * FROM pokedex WHERE id = 312', 311).mysteryGuess;
    expect(twins).toMatchObject({ matched: false, type1: 'correct', type2: 'correct', generation: 'correct', height: 'correct', weight: 'correct' });
  } finally { db.close(); }
});

test('type clues handle swapped slots and absent second types; arrows point toward the target', () => {
  const pokemon: PokemonProfile = { id: 1, name: 'Example', type1: 'dragon', type2: 'flying', generationId: 4, heightM: 1, weightKg: 10 };
  expect(compareMysteryPokemon({ ...pokemon, id: 2, type1: 'flying', type2: 'dragon', generationId: 5, heightM: 0.5, weightKg: 20 }, pokemon))
    .toMatchObject({ matched: false, type1: 'partial', type2: 'partial', generation: 'lower', height: 'higher', weight: 'lower' });
  expect(compareMysteryPokemon({ ...pokemon, type2: null }, { ...pokemon, type2: null }).type2).toBe('correct');
  expect(compareMysteryPokemon({ ...pokemon, type2: null }, pokemon).type2).toBe('wrong');
  expect(compareMysteryPokemon(pokemon, { ...pokemon, type2: null }).type2).toBe('wrong');
});

test('research, empty, truncated, duplicate, and ambiguous results do not become guesses', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only = ON');
    for (const sql of [
      'SELECT * FROM pokedex LIMIT 10', 'SELECT * FROM pokedex WHERE 0', 'SELECT COUNT(*) FROM pokemon',
      'SELECT id FROM pokedex WHERE id = 5 UNION ALL SELECT id FROM pokedex WHERE id = 5',
      'SELECT a.id FROM pokemon a CROSS JOIN pokemon b', 'SELECT NULL AS id', 'SELECT 999999 AS id',
      'SELECT 5 AS id, 6 AS id', "SELECT 'missing' AS name", 'SELECT 1.5 AS id', '-- just a comment',
      "SELECT 'Pikachu' AS id", 'SELECT 25 AS name',
    ]) {
      const reply = runMysteryQuery(db, sql, 6);
      expect(reply.mysteryGuess, sql).toBeUndefined();
      expect(reply.notice, sql).toContain('Research query only');
    }
    expect(() => runMysteryQuery(db, 'DELETE FROM pokemon', 6)).toThrow(/one SELECT/);
    expect(() => runMysteryQuery(db, 'SELECT 5 AS id; SELECT 6 AS id', 6)).toThrow(/one SELECT/);
    expect(() => runMysteryQuery(db, 'WITH x AS (SELECT 1) DELETE FROM pokemon', 6)).toThrow(/readonly/);
    expect(() => runMysteryQuery(db, 'SELECT 5 AS id', 999999)).toThrow(/New Pokémon/);
    expect(db.exec('SELECT COUNT(*) FROM pokemon')[0].values).toEqual([[1025]]);
  } finally { db.close(); }
});

test('new mysteries choose a database species and exclude the preceding target', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only = ON');
    for (let i = 0; i < 10; i++) {
      const id = pickMysteryTarget(db, 25);
      expect(id).not.toBe(25);
      expect(db.exec('SELECT COUNT(*) FROM pokemon WHERE id = ?', [id])[0].values).toEqual([[1]]);
    }
  } finally { db.close(); }
});

test('round persistence validates nested data, retains recent guesses, and freezes a solved round', () => {
  const pokemon: PokemonProfile = { id: 1, name: 'Bulbasaur', type1: 'grass', type2: 'poison', generationId: 1, heightM: 0.7, weightKg: 6.9 };
  const feedback = compareMysteryPokemon(pokemon, { ...pokemon, id: 2 });
  let round = { targetId: 2, guessCount: 0, attempts: [] } as Parameters<typeof recordMysteryGuess>[0];
  for (let i = 0; i < MYSTERY_HISTORY_LIMIT + 2; i++) round = recordMysteryGuess(round, `SELECT ${i} AS example`, feedback);
  expect(round.guessCount).toBe(MYSTERY_HISTORY_LIMIT + 2);
  expect(round.attempts).toHaveLength(MYSTERY_HISTORY_LIMIT);
  expect(round.attempts[0].sql).toBe('SELECT 2 AS example');
  expect(isMysteryRound(JSON.parse(JSON.stringify(round)))).toBe(true);
  expect(mysterySolved(round)).toBe(false);
  const solved = recordMysteryGuess(round, 'SELECT 2 AS id', { ...feedback, matched: true, pokemon: { ...pokemon, id: 2 } });
  expect(mysterySolved(solved)).toBe(true);
  expect(recordMysteryGuess(solved, 'SELECT 1 AS id', feedback)).toBe(solved);
  for (const invalid of [
    {}, { ...round, targetId: -1 }, { ...round, targetId: 1026 }, { ...round, guessCount: '32' }, { ...round, attempts: [null] },
    ...[null, '12', 4, 51, 12.5].map(level => ({ ...round, level })),
    { ...round, attempts: [{ sql: 'SELECT 1', feedback: { ...feedback, height: 'bogus' } }] },
    { ...round, attempts: [{ sql: 'SELECT 1', feedback: { ...feedback, pokemon: { ...pokemon, heightM: '0.7' } } }] },
  ]) expect(isMysteryRound(invalid)).toBe(false);
});
