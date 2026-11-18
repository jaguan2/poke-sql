import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { SQL_GUIDE_TOPICS } from '../src/sql-guide';
import { runStatements } from '../src/engine';

test('every guide example runs read-only against the bundled database', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    db.run('PRAGMA query_only = ON');
    for (const topic of SQL_GUIDE_TOPICS) {
      const results = runStatements(db, topic.sql, true);
      expect(results, topic.title).toHaveLength(1);
      expect(results[0].values.length, topic.title).toBeGreaterThan(0);
    }
    expect(db.exec('SELECT COUNT(*) FROM pokemon')[0].values).toEqual([[1025]]);
  } finally { db.close(); }
});

test('guide examples demonstrate join multiplicity, NULL handling, and one winner per generation', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  const example = (title: string) => runStatements(db, SQL_GUIDE_TOPICS.find(topic => topic.title === title)!.sql, true)[0];
  try {
    expect(example('JOIN tables').values.slice(0, 2)).toEqual([['Bulbasaur', 'grass'], ['Bulbasaur', 'poison']]);
    expect(example('NULL values').values.every(row => row[1] === 'None')).toBe(true);
    const winners = example('Window functions');
    expect(winners.values.map(row => row[1])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const [name, generation, speed] of winners.values) {
      const faster = db.exec('SELECT COUNT(*) FROM pokedex WHERE generation_id = ? AND speed > ?', [generation, speed]);
      expect(faster[0].values, String(name)).toEqual([[0]]);
    }
  } finally { db.close(); }
});
