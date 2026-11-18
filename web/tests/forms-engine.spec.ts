import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';

test('form summaries preserve species counts and agree with the linked forms', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  const rows = (sql: string) => db.exec(sql)[0]?.values ?? [];
  try {
    expect(rows('PRAGMA user_version')).toEqual([[1]]);
    expect(rows('SELECT COUNT(*), COUNT(DISTINCT id) FROM pokedex')).toEqual([[1025, 1025]]);
    expect(rows('SELECT COUNT(*) FROM pokemon')).toEqual([[1025]]);
    expect(rows(`SELECT p.id FROM pokemon p LEFT JOIN pokemon_forms f
      ON f.species_id = p.id AND f.is_species_default = 1
      GROUP BY p.id HAVING COUNT(f.id) <> 1`)).toEqual([]);
    expect(rows(`SELECT p.id FROM pokemon p WHERE
      p.mega_form_count <> (SELECT COUNT(*) FROM pokemon_forms f WHERE f.species_id = p.id AND f.is_mega = 1)
      OR p.has_mega_evolution <> (p.mega_form_count > 0)
      OR p.has_regional_form <> EXISTS(SELECT 1 FROM pokemon_forms f WHERE f.species_id = p.id AND f.is_regional = 1)`)).toEqual([]);
    expect(rows('SELECT mega_form_count, evolution_stage, can_evolve FROM pokedex WHERE id = 6')).toEqual([[2, 3, 0]]);
    expect(rows('SELECT id, evolution_stage, can_evolve FROM pokedex WHERE id IN (25,26,133,172,700) ORDER BY id'))
      .toEqual([[25, 2, 1], [26, 3, 0], [133, 1, 1], [172, 1, 1], [700, 2, 0]]);
    // Regional-only evolutions still count as children of their species.
    expect(rows('SELECT can_evolve FROM pokemon WHERE id IN (83,264) ORDER BY id')).toEqual([[1], [1]]);
    expect(rows('SELECT id, capture_rate, color, habitat, is_baby FROM pokedex WHERE id IN (172,700) ORDER BY id'))
      .toEqual([[172, 190, 'yellow', 'forest', 1], [700, 45, 'pink', null, 0]]);
  } finally { db.close(); }
});

test('forms retain independent identities, introductions, types, stats, and abilities', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  const rows = (sql: string) => db.exec(sql)[0]?.values ?? [];
  try {
    expect(rows(`SELECT f.name, p.generation_id, f.introduced_generation_id,
      f.total_stats, f.is_mega, f.is_species_default
      FROM pokemon_forms f JOIN pokemon p ON p.id=f.species_id WHERE p.id=6 ORDER BY f.id`))
      .toEqual([['Charizard', 1, 1, 534, 0, 1], ['Mega Charizard X', 1, 6, 634, 1, 0],
        ['Mega Charizard Y', 1, 6, 634, 1, 0], ['Gigantamax Charizard', 1, 8, 534, 0, 0]]);
    expect(rows(`SELECT f.id <> f.species_id, f.id <> f.source_pokemon_id, f.species_id <> f.source_pokemon_id
      FROM pokemon_forms f WHERE f.identifier='charizard-mega-x'`)).toEqual([[1, 1, 1]]);
    expect(rows(`SELECT f.name, t.name, ft.slot FROM pokemon_forms f
      JOIN pokemon_form_types ft ON ft.form_id=f.id JOIN types t ON t.id=ft.type_id
      WHERE f.species_id=6 AND f.is_mega=1 ORDER BY f.id, ft.slot`))
      .toEqual([['Mega Charizard X', 'fire', 1], ['Mega Charizard X', 'dragon', 2],
        ['Mega Charizard Y', 'fire', 1], ['Mega Charizard Y', 'flying', 2]]);
    expect(rows(`SELECT f.identifier, a.name FROM pokemon_forms f
      JOIN pokemon_form_abilities fa ON fa.form_id=f.id JOIN abilities a ON a.id=fa.ability_id
      WHERE f.species_id=6 AND f.is_mega=1 ORDER BY f.id`))
      .toEqual([['charizard-mega-x', 'Tough Claws'], ['charizard-mega-y', 'Drought']]);
    expect(rows(`SELECT f.identifier, t.name FROM pokemon_forms f
      LEFT JOIN pokemon_form_types ft ON ft.form_id=f.id LEFT JOIN types t ON t.id=ft.type_id
      WHERE f.identifier IN ('arceus-fire','arceus-normal','arceus-unknown','silvally-fire') ORDER BY f.identifier`))
      .toEqual([['arceus-fire', 'fire'], ['arceus-normal', 'normal'], ['arceus-unknown', null], ['silvally-fire', 'fire']]);
    expect(rows('SELECT id, has_regional_form FROM pokemon WHERE id IN (25,26,128) ORDER BY id'))
      .toEqual([[25, 0], [26, 1], [128, 1]]);
    expect(rows("SELECT is_regional, regional_region FROM pokemon_forms WHERE identifier='pikachu-alola-cap'"))
      .toEqual([[0, null]]);
    expect(rows('SELECT regional_region, COUNT(*) FROM pokemon_forms WHERE species_id=128 AND is_regional=1 GROUP BY regional_region'))
      .toEqual([['Paldea', 3]]);
    expect(rows(`SELECT COUNT(*) FROM pokemon_forms WHERE total_stats <>
      hp+attack+defense+special_attack+special_defense+speed`)).toEqual([[0]]);
    expect(rows('SELECT COUNT(*) FROM types')).toEqual([[18]]);
  } finally { db.close(); }
});
