import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { collectionAchievements, readAchievementCatalog } from '../src/achievements';
import type { AchievementCatalog } from '../src/types';
import { entriesFor } from './fixtures/pokemon-encounters';

let catalog: AchievementCatalog;
test.beforeAll(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try { db.run('PRAGMA query_only = ON'); catalog = readAchievementCatalog(db); }
  finally { db.close(); }
});

test('goals use the bundled original species, generation, and distinct type totals', () => {
  expect(catalog.speciesCount).toBe(1025);
  expect(catalog.generations.map(generation => generation.total)).toEqual([151, 100, 135, 107, 156, 72, 88, 96, 120]);
  expect(catalog.generations.reduce((sum, generation) => sum + generation.total, 0)).toBe(catalog.speciesCount);
  expect(catalog.generations[0]).toMatchObject({ id: 1, name: 'Generation I', region: 'Kanto' });
  expect(catalog.types).toHaveLength(18);
  expect(catalog.types.find(type => type.name === 'fire')?.total).toBe(81);
  expect(catalog.types.find(type => type.name === 'flying')?.total).toBe(109);
});

test('unique species count once per generation and each type regardless of repeated wins or modes', async () => {
  const entries = await entriesFor([6, 6]);
  entries[0].sources = ['daily', 'random'];
  const before = JSON.stringify(entries);
  const progress = collectionAchievements(entries, catalog);
  expect(progress.overall.count).toBe(1);
  expect(progress.generations[0].count).toBe(1);
  expect(progress.types.find(type => type.id === 'type-fire')?.count).toBe(1);
  expect(progress.types.find(type => type.id === 'type-flying')?.count).toBe(1);
  expect(JSON.stringify(entries)).toBe(before);
  const repeatedType = [{ ...entries[0], pokemon: { ...entries[0].pokemon, type2: 'fire' } }];
  expect(collectionAchievements(repeatedType, catalog).types.find(type => type.id === 'type-fire')?.count).toBe(1);
});

test('cross-generation evolution families count toward each species own debut generation', async () => {
  const progress = collectionAchievements(await entriesFor([6, 172, 700, 979]), catalog);
  expect(progress.generations.filter(generation => generation.count > 0).map(generation => [generation.id, generation.count]))
    .toEqual([['generation-1', 1], ['generation-2', 1], ['generation-6', 1], ['generation-9', 1]]);
});

test('a fifth unique Fire species earns the milestone and replayed discoveries cannot advance it', async () => {
  const entries = await entriesFor([4, 5, 6, 37, 38]);
  const fireBefore = collectionAchievements(entries.slice(0, 4), catalog).types.find(type => type.id === 'type-fire')!;
  const progress = collectionAchievements(entries, catalog);
  const fireAfter = progress.types.find(type => type.id === 'type-fire')!;
  expect(fireBefore.milestones.find(milestone => milestone.target === 5)?.earned).toBe(false);
  expect(fireAfter.count).toBe(5);
  expect(fireAfter.milestones.find(milestone => milestone.target === 5)?.earned).toBe(true);
  expect(collectionAchievements([...entries, entries[4]], catalog)).toEqual(progress);
});

test('zero and full collections have correct completion milestones without unreachable or duplicate tiers', async () => {
  expect(collectionAchievements([], catalog).earnedCount).toBe(0);
  const all = await entriesFor(Array.from({ length: 1025 }, (_, index) => index + 1));
  const genOne = collectionAchievements(all.filter(entry => entry.pokemon.generationId === 1), catalog).generations[0];
  expect(genOne.count).toBe(151);
  expect(genOne.milestones.every(milestone => milestone.earned)).toBe(true);
  const full = collectionAchievements(all, catalog);
  expect(full.earnedCount).toBe(full.milestoneCount);
  for (const track of [full.overall, ...full.generations, ...full.types]) {
    expect(track.count, track.title).toBe(track.total);
    expect(track.milestones.at(-1)?.target, track.title).toBe(track.total);
    expect(new Set(track.milestones.map(milestone => milestone.target)).size).toBe(track.milestones.length);
    expect(track.milestones.every(milestone => milestone.target <= track.total)).toBe(true);
  }
});
