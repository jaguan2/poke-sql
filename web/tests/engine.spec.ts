import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { CHALLENGES, matchesResults } from '../src/challenges';
import { hasOpenTransaction, readSchema, runStatements } from '../src/engine';

test('database integrity, samples, and challenge solutions', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    expect(db.exec('PRAGMA integrity_check')[0].values).toEqual([['ok']]);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    const { SAMPLE_QUERIES } = await import('../src/samples');
    for (const query of SAMPLE_QUERIES) expect(() => runStatements(db, query.sql)).not.toThrow();
    for (const challenge of CHALLENGES) {
      const result = runStatements(db, challenge.solution, true);
      expect(result[0].values.length).toBeGreaterThan(0);
      expect(matchesResults(result, result, challenge.ordered)).toBe(true);
    }
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
