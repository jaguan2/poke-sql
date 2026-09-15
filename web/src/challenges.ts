import type { QueryResult } from "./types";

export interface Challenge {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  hint: string;
  solution: string;
  ordered?: boolean;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "first-partners", title: "First partners", topic: "SELECT · WHERE",
    prompt: "Return name and type1 for Bulbasaur, Charmander, and Squirtle from pokedex. Any row order is fine.",
    hint: "Use WHERE name IN (...) to match a list of names.",
    solution: "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');",
  },
  {
    id: "fast-ghosts", title: "Ghost race", topic: "ORDER BY · LIMIT",
    prompt: "Return name and speed for the three fastest Ghost-type Pokémon (either type slot). Sort by speed descending, then name ascending to break ties.",
    hint: "Filter both type1 and type2 with OR, then ORDER BY speed DESC, name ASC LIMIT 3.",
    solution: "SELECT name, speed FROM pokedex WHERE type1 = 'ghost' OR type2 = 'ghost' ORDER BY speed DESC, name ASC LIMIT 3;",
    ordered: true,
  },
  {
    id: "one-type", title: "One type is enough", topic: "NULL · GROUP BY",
    prompt: "Return type1 and the count of single-type Pokémon for each primary type. A single-type Pokémon has no type2. Any row order is fine.",
    hint: "NULL is tested with IS NULL. Group the remaining rows by type1.",
    solution: "SELECT type1, COUNT(*) FROM pokedex WHERE type2 IS NULL GROUP BY type1;",
  },
  {
    id: "generation-counts", title: "A growing Pokédex", topic: "Aggregates",
    prompt: "Return generation_id and the Pokémon count for every generation. Sort chronologically by generation_id.",
    hint: "GROUP BY generation_id, then ORDER BY generation_id.",
    solution: "SELECT generation_id, COUNT(*) FROM pokemon GROUP BY generation_id ORDER BY generation_id;",
    ordered: true,
  },
  {
    id: "dragon-counters", title: "Beat the Dragon", topic: "JOIN",
    prompt: "Return the attacking type name and damage_factor for every type that is super-effective against Dragon. Use types and type_matchups. Any row order is fine.",
    hint: "Join types twice: once for the attacking type, once for the defending type. Super-effective means damage_factor > 1.",
    solution: "SELECT a.name, m.damage_factor FROM type_matchups m JOIN types a ON a.id = m.attacking_type_id JOIN types d ON d.id = m.defending_type_id WHERE d.name = 'dragon' AND m.damage_factor > 1;",
  },
  {
    id: "hidden-abilities", title: "Snorlax's secret", topic: "Many-to-many JOIN",
    prompt: "Return the Pokémon name and ability name for Snorlax's hidden ability. Use pokemon, pokemon_abilities, and abilities.",
    hint: "pokemon_abilities links Pokémon to abilities; filter is_hidden = 1.",
    solution: "SELECT p.name, a.name FROM pokemon p JOIN pokemon_abilities pa ON pa.pokemon_id = p.id JOIN abilities a ON a.id = pa.ability_id WHERE p.name = 'Snorlax' AND pa.is_hidden = 1;",
  },
  {
    id: "evolution", title: "Family tree", topic: "Self-join",
    prompt: "Return Eevee's name in the first column and each of its direct evolutions' names in the second column. Any row order is fine.",
    hint: "Join pokemon parent to pokemon child ON child.evolves_from_id = parent.id, then filter parent.name = 'Eevee'.",
    solution: "SELECT parent.name, child.name FROM pokemon parent JOIN pokemon child ON child.evolves_from_id = parent.id WHERE parent.name = 'Eevee';",
  },
  {
    id: "generation-champions", title: "Generation champions", topic: "Window functions",
    prompt: "Return generation_id, name, and total_stats for the strongest Pokémon in each generation. Include all ties. Sort by generation_id, then name ascending.",
    hint: "Use RANK() OVER (PARTITION BY generation_id ORDER BY total_stats DESC) in a subquery, then keep rank 1.",
    solution: "SELECT generation_id, name, total_stats FROM (SELECT generation_id, name, total_stats, RANK() OVER (PARTITION BY generation_id ORDER BY total_stats DESC) AS r FROM pokemon) WHERE r = 1 ORDER BY generation_id, name;",
    ordered: true,
  },
];

/** Aliases do not matter; column order, value types, duplicates and NULLs do. */
export function matchesResults(actual: QueryResult[], expected: QueryResult[], ordered = false): boolean {
  if (actual.length !== 1 || expected.length !== 1) return false;
  const [a] = actual;
  const [e] = expected;
  if (a.truncated || e.truncated || a.columns.length !== e.columns.length || a.values.length !== e.values.length) return false;
  const encode = (rows: QueryResult["values"]) => rows.map(row => JSON.stringify(row.map(value =>
    value instanceof Uint8Array ? { blob: Array.from(value) } : value)));
  const left = encode(a.values);
  const right = encode(e.values);
  if (!ordered) { left.sort(); right.sort(); }
  return left.every((row, i) => row === right[i]);
}
