import type { Database, SqlValue } from "sql.js";
import type { PokemonProfile } from "../pokemon/profile";

const columns = "id, name, type1, type2, generation_id, height_m, weight_kg";
function profile(row: SqlValue[]): PokemonProfile {
  return { id: Number(row[0]), name: String(row[1]), type1: String(row[2]), type2: row[3] === null ? null : String(row[3]),
    generationId: Number(row[4]), heightM: Number(row[5]), weightKg: Number(row[6]) };
}
export function readPokemonProfile(db: Database, identity: number | string): PokemonProfile | undefined {
  const row = db.exec(`SELECT ${columns} FROM pokedex WHERE ${typeof identity === "number" ? "id = ?" : "name = ? COLLATE NOCASE"}`, [identity])[0]?.values[0];
  return row ? profile(row) : undefined;
}
export function readPokemonCatalog(db: Database): PokemonProfile[] {
  return db.exec(`SELECT ${columns} FROM pokedex ORDER BY id`)[0].values.map(profile);
}
