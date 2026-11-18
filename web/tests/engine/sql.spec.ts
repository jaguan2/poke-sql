import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { CHALLENGES } from '../../src/features/practice/challenges';
import { matchesResults } from '../../src/shared/sql/compare-results';
import { exportSnapshot, hasOpenTransaction, readSchema, runStatements } from '../../src/shared/sql/engine';

test('database integrity, samples, and challenge solutions', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    expect(db.exec('PRAGMA integrity_check')[0].values).toEqual([['ok']]);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    const { SAMPLE_QUERIES } = await import('../../src/features/practice/samples');
    db.exec('PRAGMA query_only = ON');
    for (const query of SAMPLE_QUERIES) {
      const expected = runStatements(db, query.sql, true);
      expect(expected[0].values.length).toBeGreaterThan(0);
      for (const answer of query.alternatives ?? []) {
        expect(matchesResults(runStatements(db, answer.sql, true), expected, true), `${query.title}: ${answer.title}`).toBe(true);
      }
    }
    for (const challenge of CHALLENGES) {
      const result = runStatements(db, challenge.solution, true);
      expect(result[0].values.length).toBeGreaterThan(0);
      for (const answer of challenge.alternatives) {
        expect(matchesResults(runStatements(db, answer.sql, true), result, challenge.ordered), `${challenge.title}: ${answer.title}`).toBe(true);
      }
    }
  } finally { db.close(); }
});

test('popular Pokémon problems return their promised species, evolution stages, and type multipliers', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  const { SAMPLE_QUERIES } = await import('../../src/features/practice/samples');
  const sample = (id: string) => runStatements(db, SAMPLE_QUERIES.find(query => query.id === id)!.sql, true)[0].values;
  const challenge = (id: string) => runStatements(db, CHALLENGES.find(query => query.id === id)!.solution, true)[0].values;
  try {
    db.run('PRAGMA query_only = ON');
    expect(challenge('charizard-profile')).toEqual([['Charizard', 'fire', 'flying', 534]]);
    expect(sample('charizard-card')[0].filter(value => typeof value === 'number')).toEqual([78, 100, 534]);
    expect(sample('pikachu-eevee').map(row => row[0])).toEqual(['Pikachu', 'Eevee']);
    expect(sample('kanto-starter-showdown').map(row => row[0])).toEqual(['Charizard', 'Blastoise', 'Venusaur']);
    expect(sample('heavier-than-snorlax')).toHaveLength(10);
    expect(sample('heavier-than-snorlax').every(row => Number(row[1]) > 460)).toBe(true);
    expect(sample('gengar-rivals').map(row => row[0])).toEqual(['Dragapult', 'Flutter Mane', 'Spectrier', 'Marshadow']);
    const evolutions = sample('eevee-choices');
    expect(evolutions.map(row => row[0]).sort()).toEqual(['Espeon', 'Flareon', 'Glaceon', 'Jolteon', 'Leafeon', 'Sylveon', 'Umbreon', 'Vaporeon']);
    expect(evolutions[0][0]).toBe('Jolteon');
    expect(sample('charizard-abilities')).toEqual([['Charizard', 'Blaze', 0], ['Charizard', 'Solar Power', 1]]);
    expect(sample('dragonite-family')).toEqual([[1, 'Dratini'], [2, 'Dragonair'], [3, 'Dragonite']]);
    expect(challenge('lucario-abilities')).toEqual([['Lucario', 'Inner Focus', 0], ['Lucario', 'Steadfast', 0], ['Lucario', 'Justified', 1]]);
    expect(challenge('charizard-weaknesses')).toEqual([['rock', 4], ['electric', 2], ['water', 2]]);
    const speedClub = challenge('pikachu-speed-club');
    expect(speedClub).toHaveLength(5);
    expect(speedClub[0]).toEqual(['Regieleki', 200]);
    expect(speedClub.every(row => Number(row[1]) > 90)).toBe(true);
  } finally { db.close(); }
});

test('grading respects duplicates, value types, NULLs, and explicit ordering', () => {
  const result = (values: (string | number | null)[][]) => [{ columns: ['alias'], values, truncated: false }];
  expect(matchesResults(result([[1], [2]]), result([[2], [1]]))).toBe(true);
  expect(matchesResults(result([[1], [2]]), result([[2], [1]]), true)).toBe(false);
  expect(matchesResults(result([[1], [1]]), result([[1], [2]]))).toBe(false);
  expect(matchesResults(result([['1']]), result([[1]]))).toBe(false);
  expect(matchesResults(result([[null]]), result([['NULL']]))).toBe(false);
  expect(matchesResults([{ ...result([[1]])[0], truncated: true }], result([[1]]))).toBe(false);
});

test('SQL practice supports transactions, capped rows, empty results, and broken views', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    runStatements(db, 'BEGIN; UPDATE pokemon SET name = \'Practice\' WHERE id = 1;');
    expect(hasOpenTransaction(db)).toBe(true);
    expect(runStatements(db, 'SELECT name FROM pokemon WHERE id = 1')[0].values).toEqual([['Practice']]);
    runStatements(db, 'ROLLBACK');
    expect(hasOpenTransaction(db)).toBe(false);
    expect(runStatements(db, 'SELECT name FROM pokemon WHERE id = 1')[0].values).toEqual([['Bulbasaur']]);
    const large = runStatements(db, 'SELECT a.id FROM pokemon a CROSS JOIN pokemon b')[0];
    expect(large.values).toHaveLength(2000); expect(large.truncated).toBe(true);
    expect(runStatements(db, 'SELECT name FROM pokemon WHERE 0')[0]).toMatchObject({ columns: ['name'], values: [] });
    expect(() => runStatements(db, "SELECT 1; SELECT * FROM missing_table")).toThrow();
    runStatements(db, 'CREATE TABLE "a""b" (id INTEGER); DROP TABLE pokemon;');
    expect(readSchema(db).some(t => t.name === 'a"b')).toBe(true);
    expect(readSchema(db).find(t => t.name === 'pokedex')?.columns).toEqual([]);
  } finally { db.close(); }
});

test('challenge mode rejects writes and multiple statements', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only = ON');
    expect(() => runStatements(db, 'DELETE FROM pokemon', true)).toThrow(/one SELECT/);
    expect(() => runStatements(db, 'SELECT 1; SELECT 2', true)).toThrow(/one SELECT/);
    expect(() => runStatements(db, 'WITH x AS (SELECT 1) DELETE FROM pokemon', true)).toThrow();
    expect(runStatements(db, '-- comment\nWITH x AS (SELECT 1) SELECT * FROM x', true)[0].values).toEqual([[1]]);
  } finally { db.close(); }
});

test('statement boundaries preserve quoted text and triggers, and errors never prepare the tail', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    const result = runStatements(db, "\ufeff; -- leading comment\nSELECT 'a;b 🚀'; SELECT 2; /* trailing comment */");
    expect(result.map(r => r.values)).toEqual([[['a;b 🚀']], [[2]]]);
    runStatements(db, 'CREATE TABLE a (id INTEGER); CREATE TABLE b (id INTEGER); CREATE TRIGGER copy AFTER INSERT ON a BEGIN INSERT INTO b VALUES (new.id); INSERT INTO b VALUES (new.id + 1); END; INSERT INTO a VALUES (3);');
    expect(runStatements(db, 'SELECT id FROM b')[0].values).toEqual([[3], [4]]);
    expect(() => runStatements(db, 'SELECT abs(-9223372036854775808); PRAGMA foreign_keys = ON;')).toThrow();
    expect(db.exec('PRAGMA foreign_keys')[0].values).toEqual([[0]]);
    expect(() => runStatements(db, 'SELECT 1;'.repeat(50) + 'PRAGMA foreign_keys = ON;')).toThrow(/at most 50/);
    expect(db.exec('PRAGMA foreign_keys')[0].values).toEqual([[0]]);
  } finally { db.close(); }
});

test('autosave preserves SQLite session settings and constraint behavior', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    runStatements(db, 'CREATE TABLE checked (id INTEGER CHECK(id > 0)); PRAGMA ignore_check_constraints = ON; PRAGMA recursive_triggers = ON; PRAGMA case_sensitive_like = ON; PRAGMA cache_size = 123;');
    exportSnapshot(db);
    expect(db.exec('PRAGMA recursive_triggers')[0].values).toEqual([[1]]);
    expect(db.exec('PRAGMA cache_size')[0].values).toEqual([[123]]);
    expect(runStatements(db, "SELECT 'a' LIKE 'A'")[0].values).toEqual([[0]]);
    expect(() => runStatements(db, 'INSERT INTO checked VALUES (-1)')).not.toThrow();
    db.run('PRAGMA query_only = ON');
    exportSnapshot(db);
    expect(() => runStatements(db, 'INSERT INTO checked VALUES (2)')).toThrow(/readonly/);
    db.run('PRAGMA query_only = OFF; PRAGMA ignore_check_constraints = OFF');
    exportSnapshot(db);
    expect(() => runStatements(db, 'INSERT INTO checked VALUES (-2)')).toThrow(/CHECK/);
  } finally { db.close(); }
});

test('schema introspection does not confuse temporary and persisted tables with the same name', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    runStatements(db, 'CREATE TABLE team (name TEXT); CREATE TEMP TABLE team (id INTEGER); CREATE TEMP TABLE practice (value TEXT);');
    expect(readSchema(db).find(table => table.name === 'team')?.columns.map(column => column.name)).toEqual(['id']);
    expect(readSchema(db).some(table => table.name === 'practice')).toBe(true);
    runStatements(db, 'DROP TABLE temp.team');
    expect(readSchema(db).find(table => table.name === 'team')?.columns.map(column => column.name)).toEqual(['name']);
  } finally { db.close(); }
});
