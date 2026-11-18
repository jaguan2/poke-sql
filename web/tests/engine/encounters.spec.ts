import { test, expect } from '@playwright/test';
import { isPokemonEncounters, recordSolvedEncounter } from '../../src/features/pokedex/encounters';
import type { PokemonEncounter } from '../../src/features/pokedex/encounters';
import { compareMysteryPokemon } from '../../src/features/mystery/model';
import type { MysteryRound } from '../../src/features/mystery/model';
import type { PokemonProfile } from '../../src/shared/pokemon/profile';

const charizard: PokemonProfile = { id: 6, name: 'Charizard', type1: 'fire', type2: 'flying', generationId: 1, heightM: 1.7, weightKg: 90.5 };
const pikachu: PokemonProfile = { id: 25, name: 'Pikachu', type1: 'electric', type2: null, generationId: 1, heightM: 0.4, weightKg: 6 };
const solved = (count = 3): MysteryRound => ({ targetId: 6, guessCount: count, attempts: [{ sql: 'SELECT 6 AS id;', feedback: compareMysteryPokemon(charizard, charizard) }] });

test('only a correctly solved target becomes an encounter', () => {
  const empty: PokemonEncounter[] = [];
  expect(recordSolvedEncounter(empty, null, 'daily')).toBe(empty);
  expect(recordSolvedEncounter(empty, { targetId: 6, guessCount: 0, attempts: [] }, 'random')).toBe(empty);
  expect(recordSolvedEncounter(empty, { targetId: 6, guessCount: 1, attempts: [{ sql: '', feedback: compareMysteryPokemon(pikachu, charizard) }] }, 'daily')).toBe(empty);
  expect(recordSolvedEncounter(empty, { ...solved(), targetId: 25 }, 'daily')).toBe(empty);
  expect(recordSolvedEncounter(empty, solved(0), 'random')).toBe(empty);
  const entries = recordSolvedEncounter(empty, solved(), 'daily', new Date('2026-01-01T12:00:00Z'));
  expect(entries).toEqual([{ pokemon: charizard, firstFoundAt: '2026-01-01T12:00:00.000Z', bestGuessCount: 3, sources: ['daily'] }]);
});

test('daily and random wins share one entry, keep the original registration, and improve the best count', () => {
  const first = recordSolvedEncounter([], solved(4), 'daily', new Date('2026-01-01T12:00:00Z'));
  expect(recordSolvedEncounter(first, solved(4), 'daily', new Date('2026-01-02T12:00:00Z'))).toBe(first);
  const both = recordSolvedEncounter(first, solved(2), 'random', new Date('2026-01-03T12:00:00Z'));
  expect(both).toHaveLength(1);
  expect(both[0]).toMatchObject({ firstFoundAt: first[0].firstFoundAt, bestGuessCount: 2, sources: ['daily', 'random'] });
  expect(recordSolvedEncounter(both, solved(7), 'random')).toBe(both);
  expect(first[0].sources).toEqual(['daily']);
  expect(first[0].bestGuessCount).toBe(4);
});

test('saved encounters reject corrupt nested values, duplicate species, invalid sources, and invalid dates', () => {
  const valid = recordSolvedEncounter([], solved(), 'random', new Date('2026-01-01T12:00:00Z'));
  expect(isPokemonEncounters([])).toBe(true);
  expect(isPokemonEncounters(JSON.parse(JSON.stringify(valid)))).toBe(true);
  for (const value of [null, {}, [null], [valid[0], valid[0]],
    [{ ...valid[0], pokemon: { ...charizard, id: 1026 } }],
    [{ ...valid[0], pokemon: { ...charizard, generationId: 10 } }],
    [{ ...valid[0], pokemon: { ...charizard, type2: 5 } }],
    [{ ...valid[0], pokemon: { ...charizard, heightM: -1 } }],
    [{ ...valid[0], bestGuessCount: 0 }], [{ ...valid[0], bestGuessCount: 1.5 }],
    [{ ...valid[0], firstFoundAt: '2026-02-30' }],
    [{ ...valid[0], firstFoundAt: 'tomorrow' }],
    [{ ...valid[0], sources: [] }], [{ ...valid[0], sources: ['daily', 'daily'] }],
    [{ ...valid[0], sources: ['research'] }]]) expect(isPokemonEncounters(value)).toBe(false);
});

test('separate species stay collected after a new round replaces the previous target', () => {
  const first = recordSolvedEncounter([], solved(), 'random');
  const newRound = { targetId: 25, guessCount: 1, attempts: [{ sql: 'SELECT 25 AS id;', feedback: compareMysteryPokemon(pikachu, pikachu) }] };
  const both = recordSolvedEncounter(first, newRound, 'random');
  expect(both.map(entry => entry.pokemon.id)).toEqual([6, 25]);
  expect(recordSolvedEncounter(both, { targetId: 133, guessCount: 0, attempts: [] }, 'random')).toBe(both);
  expect(isPokemonEncounters(both)).toBe(true);
});
