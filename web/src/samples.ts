import type { SqlAnswer } from "./learning";

export interface SampleQuery {
  id: string;
  title: string;
  prompt: string;
  hint: string;
  hintSql: string;
  sql: string;
  alternatives?: SqlAnswer[];
}

/** Specific, read-only starting points, progressing from filters to joins. */
export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "top-hp", title: "Top 10 Pok\u00e9mon by HP",
    prompt: "Return name, HP, and both types for the 10 Pok\u00e9mon with the most HP. Sort by HP descending, then National Dex number to break ties.",
    hint: "Sort largest HP first and limit the number of returned rows.",
    hintSql: "ORDER BY hp DESC, id\nLIMIT 10",
    sql: `SELECT name, hp, type1, type2
FROM pokedex
ORDER BY hp DESC, id
LIMIT 10;`,
    alternatives: [{ title: "Using a window function", sql: `SELECT name, hp, type1, type2
FROM (
  SELECT name, hp, type1, type2,
         ROW_NUMBER() OVER (ORDER BY hp DESC, id) AS position
  FROM pokedex
)
WHERE position <= 10
ORDER BY position;` }],
  },
  {
    id: "gen-one", title: "All Pok\u00e9mon from Gen 1",
    prompt: "Return National Dex number, name, and both types for every Gen 1 Pok\u00e9mon, in National Dex order.",
    hint: "generation_id is numeric, so Gen 1 is an equality filter.",
    hintSql: "WHERE generation_id = 1",
    sql: `SELECT id, name, type1, type2
FROM pokedex
WHERE generation_id = 1
ORDER BY id;`,
    alternatives: [{ title: "Using the generation name", sql: `SELECT id, name, type1, type2
FROM pokedex
WHERE generation = 'Generation I'
ORDER BY id;` }],
  },
  {
    id: "gen-two-fire", title: "All Fire-type Pok\u00e9mon from Gen 2",
    prompt: "Return name, both types, and total stats for every Gen 2 Pok\u00e9mon with Fire in either type slot. Sort by National Dex number.",
    hint: "Combine the generation filter with a parenthesized OR for both type slots.",
    hintSql: "AND (type1 = 'fire' OR type2 = 'fire')",
    sql: `SELECT name, type1, type2, total_stats
FROM pokedex
WHERE generation_id = 2
  AND (type1 = 'fire' OR type2 = 'fire')
ORDER BY id;`,
    alternatives: [{ title: "Using IN across the type slots", sql: `SELECT name, type1, type2, total_stats
FROM pokedex
WHERE generation_id = 2 AND 'fire' IN (type1, type2)
ORDER BY id;` }],
  },
  {
    id: "top-speed", title: "Top 10 fastest Pok\u00e9mon",
    prompt: "Return name, speed, and both types for the 10 fastest Pok\u00e9mon. Break speed ties by National Dex number.",
    hint: "Use a descending sort on speed, with id as the second sort key.",
    hintSql: "ORDER BY speed DESC, id",
    sql: `SELECT name, speed, type1, type2
FROM pokedex
ORDER BY speed DESC, id
LIMIT 10;`,
    alternatives: [{ title: "Using a window function", sql: `SELECT name, speed, type1, type2
FROM (
  SELECT name, speed, type1, type2,
         ROW_NUMBER() OVER (ORDER BY speed DESC, id) AS position
  FROM pokedex
)
WHERE position <= 10
ORDER BY position;` }],
  },
  {
    id: "single-type", title: "All Pok\u00e9mon with only one type",
    prompt: "Return name, type1, and type2 for every single-type Pok\u00e9mon, in National Dex order. Keep the missing second type as NULL.",
    hint: "A missing second type is NULL, not an empty string.",
    hintSql: "WHERE type2 IS NULL",
    sql: `SELECT name, type1, type2
FROM pokedex
WHERE type2 IS NULL
ORDER BY id;`,
    alternatives: [{ title: "Checking the normalized type table", sql: `SELECT d.name, d.type1, d.type2
FROM pokedex d
WHERE NOT EXISTS (
  SELECT 1 FROM pokemon_types pt
  WHERE pt.pokemon_id = d.id AND pt.slot = 2
)
ORDER BY d.id;` }],
  },
  {
    id: "heavy-legends", title: "10 heaviest legendary Pok\u00e9mon",
    prompt: "Return name, weight in kg, and height in m for the 10 heaviest legendary Pok\u00e9mon. Break weight ties by National Dex number.",
    hint: "Legendary is a 0/1 flag. Filter before sorting and limiting.",
    hintSql: "WHERE is_legendary = 1",
    sql: `SELECT name, weight_kg, height_m
FROM pokedex
WHERE is_legendary = 1
ORDER BY weight_kg DESC, id
LIMIT 10;`,
    alternatives: [{ title: "Querying the base table directly", sql: `SELECT name, weight_kg, height_m
FROM pokemon
WHERE is_legendary = 1
ORDER BY weight_kg DESC, id
LIMIT 10;` }],
  },
  {
    id: "generation-counts", title: "Number of Pok\u00e9mon in each generation",
    prompt: "Return generation name, region, and Pok\u00e9mon count for each generation. Sort chronologically.",
    hint: "COUNT(*) counts rows in each group. Use generation_id for chronological sorting.",
    hintSql: "GROUP BY generation_id, generation, region",
    sql: `SELECT generation, region, COUNT(*) AS pokemon_count
FROM pokedex
GROUP BY generation_id, generation, region
ORDER BY generation_id;`,
    alternatives: [{ title: "Joining the generation lookup", sql: `SELECT g.name AS generation, g.region, COUNT(p.id) AS pokemon_count
FROM generations g
LEFT JOIN pokemon p ON p.generation_id = g.id
GROUP BY g.id, g.name, g.region
ORDER BY g.id;` }],
  },
  {
    id: "dragon-counters", title: "Types that are strong against Dragon",
    prompt: "Return each type that is super-effective against Dragon and its damage multiplier. Sort alphabetically by attacking type.",
    hint: "Join types twice to name both ends of each matchup. Super-effective means greater than 1.",
    hintSql: "JOIN types defender ON defender.id = m.defending_type_id",
    sql: `SELECT attacker.name AS attacking_type, m.damage_factor
FROM type_matchups m
JOIN types attacker ON attacker.id = m.attacking_type_id
JOIN types defender ON defender.id = m.defending_type_id
WHERE defender.name = 'dragon' AND m.damage_factor > 1
ORDER BY attacker.name;`,
    alternatives: [{ title: "Finding Dragon with a subquery", sql: `SELECT a.name AS attacking_type, m.damage_factor
FROM type_matchups m
JOIN types a ON a.id = m.attacking_type_id
WHERE m.defending_type_id = (SELECT id FROM types WHERE name = 'dragon')
  AND m.damage_factor > 1
ORDER BY a.name;` }],
  },
  {
    id: "bulbasaur-line", title: "Bulbasaur's evolution line",
    prompt: "Return Bulbasaur, its direct evolution, and that evolution's evolution as three columns in one row.",
    hint: "Join pokemon to itself twice, following evolves_from_id. Bulbasaur has id 1.",
    hintSql: "LEFT JOIN pokemon mid ON mid.evolves_from_id = base.id",
    sql: `SELECT base.name AS first_stage, mid.name AS second_stage,
       final.name AS third_stage
FROM pokemon base
LEFT JOIN pokemon mid ON mid.evolves_from_id = base.id
LEFT JOIN pokemon final ON final.evolves_from_id = mid.id
WHERE base.id = 1;`,
    alternatives: [{ title: "Using a recursive evolution walk", sql: `WITH RECURSIVE line AS (
  SELECT id, name, 1 AS stage FROM pokemon WHERE id = 1
  UNION ALL
  SELECT p.id, p.name, line.stage + 1
  FROM pokemon p JOIN line ON p.evolves_from_id = line.id
)
SELECT MAX(CASE WHEN stage = 1 THEN name END) AS first_stage,
       MAX(CASE WHEN stage = 2 THEN name END) AS second_stage,
       MAX(CASE WHEN stage = 3 THEN name END) AS third_stage
FROM line;` }],
  },
  {
    id: "hidden-abilities", title: "Gen 1 Pok\u00e9mon with hidden abilities",
    prompt: "Return the name and hidden ability of each Gen 1 Pok\u00e9mon that has one. Sort by National Dex number.",
    hint: "pokemon_abilities is the link table; is_hidden marks the hidden ability.",
    hintSql: "WHERE p.generation_id = 1 AND pa.is_hidden = 1",
    sql: `SELECT p.name AS pokemon, a.name AS hidden_ability
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
JOIN abilities a ON a.id = pa.ability_id
WHERE p.generation_id = 1 AND pa.is_hidden = 1
ORDER BY p.id;`,
    alternatives: [{ title: "Looking up the ability with a subquery", sql: `SELECT p.name AS pokemon,
       (SELECT name FROM abilities WHERE id = pa.ability_id) AS hidden_ability
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
WHERE p.generation_id = 1 AND pa.is_hidden = 1
ORDER BY p.id;` }],
  },
  {
    id: "generation-speed", title: "3 fastest Pok\u00e9mon from every generation",
    prompt: "Return name, generation, speed, and position for exactly three Pok\u00e9mon per generation. Break speed ties by National Dex number, and sort by generation then position.",
    hint: "ROW_NUMBER assigns unique positions within each generation. Filter positions in an outer query.",
    hintSql: "ROW_NUMBER() OVER (PARTITION BY generation_id ORDER BY speed DESC, id)",
    sql: `SELECT name, generation, speed, position
FROM (
  SELECT name, generation, generation_id, speed,
         ROW_NUMBER() OVER (
           PARTITION BY generation_id ORDER BY speed DESC, id
         ) AS position
  FROM pokedex
)
WHERE position <= 3
ORDER BY generation_id, position;`,
    alternatives: [{ title: "Counting faster rivals with a correlated subquery", sql: `SELECT name, generation, speed, position
FROM (
  SELECT p.name, p.generation, p.generation_id,
         p.speed, 1 + (
           SELECT COUNT(*) FROM pokedex rival
           WHERE rival.generation_id = p.generation_id
             AND (rival.speed > p.speed OR
                  (rival.speed = p.speed AND rival.id < p.id))
         ) AS position
  FROM pokedex p
)
WHERE position <= 3
ORDER BY generation_id, position;` }],
  },
];
