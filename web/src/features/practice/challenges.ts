import type { PracticeMetadata, SqlAnswer } from "./types";

interface Challenge extends PracticeMetadata {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  hint: string;
  hintSql: string;
  solution: string;
  alternatives: SqlAnswer[];
  ordered?: boolean;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "first-partners", category: "basics", difficulty: "Beginner", title: "First partners", topic: "SELECT · WHERE",
    prompt: "Return name and type1 for Bulbasaur, Charmander, and Squirtle from pokedex. Any row order is fine.",
    hint: "Use WHERE name IN (...) to match a list of names.",
    hintSql: "WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle')",
    alternatives: [{ title: "Using OR conditions", sql: "SELECT name, type1 FROM pokedex WHERE name = 'Bulbasaur' OR name = 'Charmander' OR name = 'Squirtle';" }],
    solution: "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');",
  },
  {
    id: "charizard-profile", category: "basics", difficulty: "Beginner", title: "Meet Charizard", topic: "SELECT · WHERE",
    prompt: "Return name, type1, type2, and total_stats for Charizard from pokedex, in that column order.",
    hint: "Use an exact name filter, and select just the four requested columns.",
    hintSql: "WHERE name = 'Charizard'",
    alternatives: [{ title: "Using the National Dex number", sql: "SELECT name, type1, type2, total_stats FROM pokedex WHERE id = 6;" }],
    solution: "SELECT name, type1, type2, total_stats FROM pokedex WHERE name = 'Charizard';",
  },
  {
    id: "fast-ghosts", category: "sorting", difficulty: "Beginner", title: "Ghost race", topic: "ORDER BY · LIMIT",
    prompt: "Return name and speed for the three fastest Ghost-type Pokémon (either type slot). Sort by speed descending, then name ascending to break ties.",
    hint: "Filter both type1 and type2 with OR, then ORDER BY speed DESC, name ASC LIMIT 3.",
    hintSql: "WHERE type1 = 'ghost' OR type2 = 'ghost'",
    alternatives: [{ title: "Using IN across type slots", sql: "SELECT name, speed FROM pokedex WHERE 'ghost' IN (type1, type2) ORDER BY speed DESC, name ASC LIMIT 3;" }],
    solution: "SELECT name, speed FROM pokedex WHERE type1 = 'ghost' OR type2 = 'ghost' ORDER BY speed DESC, name ASC LIMIT 3;",
    ordered: true,
  },
  {
    id: "pikachu-speed-club", category: "advanced", difficulty: "Intermediate", title: "Pikachu's speed club", topic: "Subquery · ORDER BY",
    prompt: "Return name and speed for the five fastest Electric-type Pokémon that are faster than Pikachu. Check either type slot and look up Pikachu's speed in SQL. Sort by speed descending, then name ascending.",
    hint: "Compare speed with a subquery that selects Pikachu's speed, then sort and limit the matching Electric types.",
    hintSql: "AND speed > (SELECT speed FROM pokedex WHERE name = 'Pikachu')",
    alternatives: [{ title: "Comparing with Pikachu in a self-join", sql: `SELECT rival.name, rival.speed
FROM pokedex rival
JOIN pokedex pikachu ON pikachu.name = 'Pikachu'
WHERE 'electric' IN (rival.type1, rival.type2)
  AND rival.speed > pikachu.speed
ORDER BY rival.speed DESC, rival.name
LIMIT 5;` }],
    solution: `SELECT name, speed
FROM pokedex
WHERE (type1 = 'electric' OR type2 = 'electric')
  AND speed > (SELECT speed FROM pokedex WHERE name = 'Pikachu')
ORDER BY speed DESC, name
LIMIT 5;`,
    ordered: true,
  },
  {
    id: "one-type", category: "aggregation", difficulty: "Intermediate", title: "One type is enough", topic: "NULL · GROUP BY",
    prompt: "Return type1 and the count of single-type Pokémon for each primary type. A single-type Pokémon has no type2. Any row order is fine.",
    hint: "NULL is tested with IS NULL. Group the remaining rows by type1.",
    hintSql: "WHERE type2 IS NULL\nGROUP BY type1",
    alternatives: [{ title: "Checking the normalized type table", sql: "SELECT d.type1, COUNT(*) FROM pokedex d WHERE NOT EXISTS (SELECT 1 FROM pokemon_types pt WHERE pt.pokemon_id = d.id AND pt.slot = 2) GROUP BY d.type1;" }],
    solution: "SELECT type1, COUNT(*) FROM pokedex WHERE type2 IS NULL GROUP BY type1;",
  },
  {
    id: "generation-counts", category: "aggregation", difficulty: "Beginner", title: "A growing Pokédex", topic: "Aggregates",
    prompt: "Return generation_id and the Pokémon count for every generation. Sort chronologically by generation_id.",
    hint: "GROUP BY generation_id, then ORDER BY generation_id.",
    hintSql: "COUNT(*) AS pokemon_count",
    alternatives: [{ title: "Joining the generation lookup", sql: "SELECT g.id, COUNT(p.id) FROM generations g LEFT JOIN pokemon p ON p.generation_id = g.id GROUP BY g.id ORDER BY g.id;" }],
    solution: "SELECT generation_id, COUNT(*) FROM pokemon GROUP BY generation_id ORDER BY generation_id;",
    ordered: true,
  },
  {
    id: "dragon-counters", category: "joins", difficulty: "Intermediate", title: "Beat the Dragon", topic: "JOIN",
    prompt: "Return the attacking type name and damage_factor for every type that is super-effective against Dragon. Use types and type_matchups. Any row order is fine.",
    hint: "Join types twice: once for the attacking type, once for the defending type. Super-effective means damage_factor > 1.",
    hintSql: "JOIN types d ON d.id = m.defending_type_id",
    alternatives: [{ title: "Finding Dragon with a subquery", sql: "SELECT a.name, m.damage_factor FROM type_matchups m JOIN types a ON a.id = m.attacking_type_id WHERE m.defending_type_id = (SELECT id FROM types WHERE name = 'dragon') AND m.damage_factor > 1;" }],
    solution: "SELECT a.name, m.damage_factor FROM type_matchups m JOIN types a ON a.id = m.attacking_type_id JOIN types d ON d.id = m.defending_type_id WHERE d.name = 'dragon' AND m.damage_factor > 1;",
  },
  {
    id: "hidden-abilities", category: "joins", difficulty: "Intermediate", title: "Snorlax's secret", topic: "Many-to-many JOIN",
    prompt: "Return the Pokémon name and ability name for Snorlax's hidden ability. Use pokemon, pokemon_abilities, and abilities.",
    hint: "pokemon_abilities links Pokémon to abilities; filter is_hidden = 1.",
    hintSql: "JOIN pokemon_abilities pa ON pa.pokemon_id = p.id",
    alternatives: [{ title: "Looking up the ability with a subquery", sql: "SELECT p.name, (SELECT name FROM abilities WHERE id = pa.ability_id) FROM pokemon p JOIN pokemon_abilities pa ON pa.pokemon_id = p.id WHERE p.name = 'Snorlax' AND pa.is_hidden = 1;" }],
    solution: "SELECT p.name, a.name FROM pokemon p JOIN pokemon_abilities pa ON pa.pokemon_id = p.id JOIN abilities a ON a.id = pa.ability_id WHERE p.name = 'Snorlax' AND pa.is_hidden = 1;",
  },
  {
    id: "lucario-abilities", category: "joins", difficulty: "Intermediate", title: "Lucario's ability list", topic: "Many-to-many JOIN",
    prompt: "Return Lucario's name, each ability name, and is_hidden for all of its abilities. Sort by is_hidden ascending, then ability name ascending. Use pokemon, pokemon_abilities, and abilities.",
    hint: "Join through pokemon_abilities. Keep normal abilities as well as hidden ones; the flag is an output column, not a filter.",
    hintSql: "ORDER BY pa.is_hidden, a.name",
    alternatives: [{ title: "Looking up the ability name with a subquery", sql: `SELECT p.name,
       (SELECT name FROM abilities WHERE id = pa.ability_id) AS ability,
       pa.is_hidden
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
WHERE p.name = 'Lucario'
ORDER BY pa.is_hidden, ability;` }],
    solution: `SELECT p.name, a.name AS ability, pa.is_hidden
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
JOIN abilities a ON a.id = pa.ability_id
WHERE p.name = 'Lucario'
ORDER BY pa.is_hidden, a.name;`,
    ordered: true,
  },
  {
    id: "evolution", category: "joins", difficulty: "Intermediate", title: "Family tree", topic: "Self-join",
    prompt: "Return Eevee's name in the first column and each of its direct evolutions' names in the second column. Any row order is fine.",
    hint: "Join pokemon parent to pokemon child ON child.evolves_from_id = parent.id, then filter parent.name = 'Eevee'.",
    hintSql: "JOIN pokemon child ON child.evolves_from_id = parent.id",
    alternatives: [{ title: "Using a correlated EXISTS filter", sql: "SELECT 'Eevee' AS parent, child.name FROM pokemon child WHERE EXISTS (SELECT 1 FROM pokemon parent WHERE parent.id = child.evolves_from_id AND parent.name = 'Eevee');" }],
    solution: "SELECT parent.name, child.name FROM pokemon parent JOIN pokemon child ON child.evolves_from_id = parent.id WHERE parent.name = 'Eevee';",
  },
  {
    id: "generation-champions", category: "advanced", difficulty: "Advanced", title: "Generation champions", topic: "Window functions",
    prompt: "Return generation_id, name, and total_stats for the strongest Pokémon in each generation. Include all ties. Sort by generation_id, then name ascending.",
    hint: "Use RANK() OVER (PARTITION BY generation_id ORDER BY total_stats DESC) in a subquery, then keep rank 1.",
    hintSql: "RANK() OVER (PARTITION BY generation_id ORDER BY total_stats DESC)",
    alternatives: [{ title: "Using a correlated maximum", sql: "SELECT p.generation_id, p.name, p.total_stats FROM pokemon p WHERE p.total_stats = (SELECT MAX(rival.total_stats) FROM pokemon rival WHERE rival.generation_id = p.generation_id) ORDER BY p.generation_id, p.name;" }],
    solution: "SELECT generation_id, name, total_stats FROM (SELECT generation_id, name, total_stats, RANK() OVER (PARTITION BY generation_id ORDER BY total_stats DESC) AS r FROM pokemon) WHERE r = 1 ORDER BY generation_id, name;",
    ordered: true,
  },
  {
    id: "charizard-weaknesses", category: "joins", difficulty: "Advanced", title: "Charizard's type weaknesses", topic: "JOIN · Arithmetic",
    prompt: "Return each attacking type name and its combined damage multiplier against Charizard's two types. Keep only multipliers greater than 1, sorted by multiplier descending, then attacking type name ascending. Use the type chart only; ignore abilities and battle conditions.",
    hint: "Find Charizard's type slots with pokemon_types. Join type_matchups for both defending types, matching the same attacking type, then multiply the two damage_factor values.",
    hintSql: "first_hit.damage_factor * second_hit.damage_factor AS damage_multiplier",
    solution: `SELECT attacker.name AS attacking_type,
       first_hit.damage_factor * second_hit.damage_factor AS damage_multiplier
FROM pokemon p
JOIN pokemon_types first_type ON first_type.pokemon_id = p.id AND first_type.slot = 1
JOIN pokemon_types second_type ON second_type.pokemon_id = p.id AND second_type.slot = 2
JOIN type_matchups first_hit ON first_hit.defending_type_id = first_type.type_id
JOIN type_matchups second_hit
  ON second_hit.defending_type_id = second_type.type_id
  AND second_hit.attacking_type_id = first_hit.attacking_type_id
JOIN types attacker ON attacker.id = first_hit.attacking_type_id
WHERE p.name = 'Charizard'
  AND first_hit.damage_factor * second_hit.damage_factor > 1
ORDER BY damage_multiplier DESC, attacker.name;`,
    alternatives: [{ title: "Naming each defense with a CTE", sql: `WITH defenses AS (
  SELECT pt.slot, m.attacking_type_id, m.damage_factor
  FROM pokemon p
  JOIN pokemon_types pt ON pt.pokemon_id = p.id
  JOIN type_matchups m ON m.defending_type_id = pt.type_id
  WHERE p.name = 'Charizard'
)
SELECT attacker.name AS attacking_type,
       first_hit.damage_factor * second_hit.damage_factor AS damage_multiplier
FROM defenses first_hit
JOIN defenses second_hit ON second_hit.attacking_type_id = first_hit.attacking_type_id
JOIN types attacker ON attacker.id = first_hit.attacking_type_id
WHERE first_hit.slot = 1 AND second_hit.slot = 2
  AND first_hit.damage_factor * second_hit.damage_factor > 1
ORDER BY damage_multiplier DESC, attacker.name;` }],
    ordered: true,
  },
  {
    id: "kanto-mega-species", category: "basics", difficulty: "Beginner", title: "Kanto's Mega roster", topic: "Flags · WHERE",
    prompt: "Return name and mega_form_count for Gen 1 species with a Mega Evolution, in that column order. Sort by National Dex number. Keep one row per species.",
    hint: "The pokedex view has species-level Mega summaries, so no JOIN is needed.",
    hintSql: "WHERE generation_id = 1 AND has_mega_evolution = 1",
    solution: "SELECT name, mega_form_count FROM pokedex WHERE generation_id = 1 AND has_mega_evolution = 1 ORDER BY id;",
    alternatives: [{ title: "Counting the linked Mega forms", sql: `SELECT p.name, COUNT(*) AS mega_form_count
FROM pokemon p JOIN pokemon_forms f ON f.species_id = p.id
WHERE p.generation_id = 1 AND f.is_mega = 1
GROUP BY p.id, p.name ORDER BY p.id;` }],
    ordered: true,
  },
  {
    id: "baby-stages", category: "sorting", difficulty: "Beginner", title: "Baby beginnings", topic: "Flags · ORDER BY",
    prompt: "Return name, evolution_stage, and can_evolve for all baby Pokémon, sorted by National Dex number. Stages follow the species family tree, starting at 1.",
    hint: "is_baby is now available in pokedex. It is a 0/1 flag, not a name or size filter.",
    hintSql: "WHERE is_baby = 1",
    solution: "SELECT name, evolution_stage, can_evolve FROM pokedex WHERE is_baby = 1 ORDER BY id;",
    alternatives: [{ title: "Using the species table", sql: "SELECT name, evolution_stage, can_evolve FROM pokemon WHERE is_baby = 1 ORDER BY id;" }],
    ordered: true,
  },
  {
    id: "charizard-mega-types", category: "joins", difficulty: "Intermediate", title: "Mega Charizard's changing types", topic: "Forms · Many-to-many JOIN",
    prompt: "Return Mega Charizard's form name, type name, and type slot for both Mega forms, in that column order. Sort by form ID, then type slot. Use pokemon_forms and pokemon_form_types; keep the species table at one row per species.",
    hint: "Join forms to their species, then form types to types. is_mega excludes default Charizard and Gigantamax.",
    hintSql: "JOIN pokemon_form_types ft ON ft.form_id = f.id",
    solution: `SELECT f.name, t.name AS type, ft.slot
FROM pokemon p
JOIN pokemon_forms f ON f.species_id = p.id
JOIN pokemon_form_types ft ON ft.form_id = f.id
JOIN types t ON t.id = ft.type_id
WHERE p.name = 'Charizard' AND f.is_mega = 1
ORDER BY f.id, ft.slot;`,
    alternatives: [{ title: "Finding the species with a subquery", sql: `SELECT f.name, t.name AS type, ft.slot
FROM pokemon_forms f
JOIN pokemon_form_types ft ON ft.form_id = f.id
JOIN types t ON t.id = ft.type_id
WHERE f.species_id = (SELECT id FROM pokemon WHERE name = 'Charizard') AND f.is_mega = 1
ORDER BY f.id, ft.slot;` }],
    ordered: true,
  },
];

