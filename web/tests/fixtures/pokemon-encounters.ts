import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import type { PokemonProfile } from '../../src/shared/pokemon/profile';
import type { PokemonEncounter } from '../../src/features/pokedex/encounters';

// Discovery fixtures always use the original database's canonical traits.
export async function entriesFor(ids: number[]): Promise<PokemonEncounter[]> {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    return ids.map((id, index) => {
      const row = db.exec('SELECT id, name, type1, type2, generation_id, height_m, weight_kg FROM pokedex WHERE id = ?', [id])[0].values[0];
      const pokemon: PokemonProfile = { id: Number(row[0]), name: String(row[1]), type1: String(row[2]), type2: row[3] === null ? null : String(row[3]), generationId: Number(row[4]), heightM: Number(row[5]), weightKg: Number(row[6]) };
      return { pokemon, firstFoundAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), bestGuessCount: index + 1, sources: ['random'] };
    });
  } finally { db.close(); }
}
