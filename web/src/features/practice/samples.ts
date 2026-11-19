import type { PracticeMetadata, SqlAnswer } from "./types";

interface SampleQuery extends PracticeMetadata {
  id: string;
  title: string;
  prompt: string;
  hint: string;
  hintSql: string;
  sql: string;
  alternatives?: SqlAnswer[];
}

/** Read-only starting points, from familiar Pokémon lookups to recursive SQL. */
export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "charizard-card", category: "basics", difficulty: "Beginner", title: "Charizard's Pokédex card",
    prompt: "Return Charizard's name, sprite_url, both types, HP, speed, and total stats. Include sprite_url to show its picture.",
    hint: "Start with pokedex and filter name with an exact equality. Text values go inside single quotes.",
    hintSql: "WHERE name = 'Charizard'",
    sql: `SELECT name, sprite_url, type1, type2, hp, speed, total_stats
FROM pokedex
WHERE name = 'Charizard';`,
    alternatives: [{ title: "Looking up the National Dex number", sql: `SELECT name, sprite_url, type1, type2, hp, speed, total_stats
FROM pokedex
WHERE id = 6;` }],
  },
  {
    id: "pikachu-eevee", category: "basics", difficulty: "Beginner", title: "Pikachu and Eevee",
    prompt: "Compare Pikachu and Eevee: return name, primary type, HP, attack, speed, and total stats for both. Sort by National Dex number.",
    hint: "IN matches a list of names without repeating the same equality test.",
    hintSql: "WHERE name IN ('Pikachu', 'Eevee')",
    sql: `SELECT name, type1, hp, attack, speed, total_stats
FROM pokedex
WHERE name IN ('Pikachu', 'Eevee')
ORDER BY id;`,
    alternatives: [{ title: "Using OR conditions", sql: `SELECT name, type1, hp, attack, speed, total_stats
FROM pokedex
WHERE name = 'Pikachu' OR name = 'Eevee'
ORDER BY id;` }],
  },
  {
    id: "kanto-starter-showdown", category: "sorting", difficulty: "Beginner", title: "Kanto starter showdown",
    prompt: "Return name, both types, special attack, speed, and total stats for Venusaur, Charizard, and Blastoise. Sort by total stats descending, then National Dex number to break ties.",
    hint: "Combine an IN filter with ORDER BY. The special attack column is named special_attack.",
    hintSql: "ORDER BY total_stats DESC, id",
    sql: `SELECT name, type1, type2, special_attack, speed, total_stats
FROM pokedex
WHERE name IN ('Venusaur', 'Charizard', 'Blastoise')
ORDER BY total_stats DESC, id;`,
    alternatives: [{ title: "Using National Dex numbers", sql: `SELECT name, type1, type2, special_attack, speed, total_stats
FROM pokedex
WHERE id IN (3, 6, 9)
ORDER BY total_stats DESC, id;` }],
  },
  {
    id: "top-hp", category: "sorting", difficulty: "Beginner", title: "Top 10 Pok\u00e9mon by HP",
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
    id: "gen-one", category: "basics", difficulty: "Beginner", title: "All Pok\u00e9mon from Gen 1",
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
    id: "gen-two-fire", category: "basics", difficulty: "Beginner", title: "All Fire-type Pok\u00e9mon from Gen 2",
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
    id: "top-speed", category: "sorting", difficulty: "Beginner", title: "Top 10 fastest Pok\u00e9mon",
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
    id: "single-type", category: "basics", difficulty: "Beginner", title: "All Pok\u00e9mon with only one type",
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
    id: "heavy-legends", category: "sorting", difficulty: "Beginner", title: "10 heaviest legendary Pok\u00e9mon",
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
    id: "heavier-than-snorlax", category: "advanced", difficulty: "Intermediate", title: "Heavier than Snorlax",
    prompt: "Find the 10 heaviest Pokémon that weigh more than Snorlax. Return name and weight in kg, sorted by weight descending, then National Dex number. Look up Snorlax's weight in SQL instead of typing a fixed number.",
    hint: "A subquery can return Snorlax's weight for the outer WHERE comparison.",
    hintSql: "WHERE weight_kg > (SELECT weight_kg FROM pokedex WHERE name = 'Snorlax')",
    sql: `SELECT name, weight_kg
FROM pokedex
WHERE weight_kg > (
  SELECT weight_kg FROM pokedex WHERE name = 'Snorlax'
)
ORDER BY weight_kg DESC, id
LIMIT 10;`,
    alternatives: [{ title: "Comparing rows with a self-join", sql: `SELECT rival.name, rival.weight_kg
FROM pokedex rival
JOIN pokedex snorlax ON snorlax.name = 'Snorlax'
WHERE rival.weight_kg > snorlax.weight_kg
ORDER BY rival.weight_kg DESC, rival.id
LIMIT 10;` }],
  },
  {
    id: "gengar-rivals", category: "advanced", difficulty: "Intermediate", title: "Faster ghosts than Gengar",
    prompt: "Return name and speed for every Ghost-type Pokémon that is faster than Gengar. Check both type slots, sort by speed descending, and break ties by National Dex number. Look up Gengar's speed in SQL.",
    hint: "Parenthesize the two type checks, then compare speed with a scalar subquery.",
    hintSql: "AND speed > (SELECT speed FROM pokedex WHERE name = 'Gengar')",
    sql: `SELECT name, speed
FROM pokedex
WHERE (type1 = 'ghost' OR type2 = 'ghost')
  AND speed > (SELECT speed FROM pokedex WHERE name = 'Gengar')
ORDER BY speed DESC, id;`,
    alternatives: [{ title: "Naming the benchmark with a CTE", sql: `WITH benchmark AS (
  SELECT speed FROM pokedex WHERE name = 'Gengar'
)
SELECT p.name, p.speed
FROM pokedex p CROSS JOIN benchmark g
WHERE 'ghost' IN (p.type1, p.type2) AND p.speed > g.speed
ORDER BY p.speed DESC, p.id;` }],
  },
  {
    id: "generation-counts", category: "aggregation", difficulty: "Beginner", title: "Number of Pok\u00e9mon in each generation",
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
    id: "dragon-counters", category: "joins", difficulty: "Intermediate", title: "Types that are strong against Dragon",
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
    id: "bulbasaur-line", category: "joins", difficulty: "Intermediate", title: "Bulbasaur's evolution line",
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
    id: "eevee-choices", category: "joins", difficulty: "Intermediate", title: "Eevee's evolution choices",
    prompt: "Compare Eevee's direct evolutions. Return name, primary type, HP, special attack, and speed, sorted by speed descending and then National Dex number.",
    hint: "The pokedex view already names each Pokémon's previous evolution in evolves_from.",
    hintSql: "WHERE evolves_from = 'Eevee'",
    sql: `SELECT name, type1, hp, special_attack, speed
FROM pokedex
WHERE evolves_from = 'Eevee'
ORDER BY speed DESC, id;`,
    alternatives: [{ title: "Following the evolution foreign key", sql: `SELECT d.name, d.type1, d.hp, d.special_attack, d.speed
FROM pokemon child
JOIN pokemon parent ON parent.id = child.evolves_from_id
JOIN pokedex d ON d.id = child.id
WHERE parent.name = 'Eevee'
ORDER BY d.speed DESC, d.id;` }],
  },
  {
    id: "charizard-abilities", category: "joins", difficulty: "Intermediate", title: "Charizard's abilities",
    prompt: "Return Charizard's name, each ability name, and the is_hidden flag for all its abilities. Put normal abilities before hidden ones, then sort by ability name.",
    hint: "pokemon_abilities connects pokemon to abilities and stores the is_hidden flag.",
    hintSql: "JOIN abilities a ON a.id = pa.ability_id",
    sql: `SELECT p.name, a.name AS ability, pa.is_hidden
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
JOIN abilities a ON a.id = pa.ability_id
WHERE p.name = 'Charizard'
ORDER BY pa.is_hidden, a.name;`,
    alternatives: [{ title: "Looking up ability names with a subquery", sql: `SELECT p.name,
       (SELECT name FROM abilities WHERE id = pa.ability_id) AS ability,
       pa.is_hidden
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
WHERE p.name = 'Charizard'
ORDER BY pa.is_hidden, ability;` }],
  },
  {
    id: "hidden-abilities", category: "joins", difficulty: "Intermediate", title: "Gen 1 Pok\u00e9mon with hidden abilities",
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
    id: "generation-speed", category: "advanced", difficulty: "Advanced", title: "3 fastest Pok\u00e9mon from every generation",
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
  {
    id: "dragonite-family", category: "advanced", difficulty: "Advanced", title: "Dragonite's family tree",
    prompt: "Return evolution stage and name for Dratini, Dragonair, and Dragonite, in evolution order. Start with Dratini and follow evolves_from_id instead of listing all three names.",
    hint: "A recursive CTE starts with Dratini, then repeatedly joins children to the previous stage.",
    hintSql: "JOIN family ON child.evolves_from_id = family.id",
    sql: `WITH RECURSIVE family AS (
  SELECT id, name, 1 AS stage
  FROM pokemon WHERE name = 'Dratini'
  UNION ALL
  SELECT child.id, child.name, family.stage + 1
  FROM pokemon child
  JOIN family ON child.evolves_from_id = family.id
)
SELECT stage, name FROM family
ORDER BY stage;`,
    alternatives: [{ title: "Unpivoting a three-stage self-join", sql: `WITH family AS (
  SELECT base.name AS first_stage, mid.name AS second_stage,
         final.name AS third_stage
  FROM pokemon base
  JOIN pokemon mid ON mid.evolves_from_id = base.id
  JOIN pokemon final ON final.evolves_from_id = mid.id
  WHERE base.name = 'Dratini'
)
SELECT 1 AS stage, first_stage AS name FROM family
UNION ALL SELECT 2, second_stage FROM family
UNION ALL SELECT 3, third_stage FROM family
ORDER BY stage;` }],
  },
  {
    id: "kanto-megas", category: "basics", difficulty: "Beginner", title: "Gen 1 Mega Evolutions",
    prompt: "Return name and Mega form count for Gen 1 species with a Mega Evolution, in National Dex order. Keep one row per species.",
    hint: "has_mega_evolution is a 0/1 species flag; mega_form_count counts its linked Mega forms.",
    hintSql: "WHERE generation_id = 1 AND has_mega_evolution = 1",
    sql: `SELECT name, mega_form_count
FROM pokedex
WHERE generation_id = 1 AND has_mega_evolution = 1
ORDER BY id;`,
  },
  {
    id: "multiple-megas", category: "sorting", difficulty: "Beginner", title: "More than one Mega form",
    prompt: "Return name and Mega form count for species with multiple Mega forms. Sort by count descending, then National Dex number.",
    hint: "Use mega_form_count > 1. Mega forms are separate from ordinary evolution stages.",
    hintSql: "WHERE mega_form_count > 1",
    sql: `SELECT name, mega_form_count
FROM pokedex
WHERE mega_form_count > 1
ORDER BY mega_form_count DESC, id;`,
  },
  {
    id: "regional-species", category: "basics", difficulty: "Beginner", title: "Pokémon with regional variants",
    prompt: "Return name and species debut generation for every species with a named regional form, in National Dex order. Costumes such as Pikachu's Alola cap do not count.",
    hint: "has_regional_form summarizes named Alolan, Galarian, Hisuian, and Paldean variants; generation_id is the species debut.",
    hintSql: "WHERE has_regional_form = 1",
    sql: `SELECT name, generation_id
FROM pokedex
WHERE has_regional_form = 1
ORDER BY id;`,
  },
  {
    id: "terminal-low-stats", category: "sorting", difficulty: "Beginner", title: "End of the family tree",
    prompt: "Find the 10 lowest-stat species with no further species evolution. Return name, evolution stage, and total stats, sorted by total stats then National Dex number. Include single-stage species.",
    hint: "can_evolve follows species family links, including regional-only branches. It is not a game-specific rule for each form. Babies start at stage 1; Mega transformations do not add a stage.",
    hintSql: "WHERE can_evolve = 0",
    sql: `SELECT name, evolution_stage, total_stats
FROM pokedex
WHERE can_evolve = 0
ORDER BY total_stats, id
LIMIT 10;`,
  },
  {
    id: "elusive-legends", category: "sorting", difficulty: "Beginner", title: "Hard-to-catch legends",
    prompt: "Return name, capture rate, color, and habitat for the 10 legendary species with the lowest capture_rate. Break ties by National Dex number and keep missing habitats as NULL.",
    hint: "capture_rate is the game's catch-rate parameter, not a percentage or a complete catch probability. Lower values are harder under otherwise equal conditions.",
    hintSql: "ORDER BY capture_rate, id",
    sql: `SELECT name, capture_rate, color, habitat
FROM pokedex
WHERE is_legendary = 1
ORDER BY capture_rate, id
LIMIT 10;`,
  },
  {
    id: "charizard-forms", category: "joins", difficulty: "Intermediate", title: "Charizard and its Mega forms",
    prompt: "Compare Charizard's default and Mega forms. Return form name, species debut generation, form introduction generation, attack, special attack, and total stats. Sort by form ID; exclude Gigantamax.",
    hint: "Join pokemon_forms.species_id to pokemon.id. Form IDs and source_pokemon_id are not National Dex numbers. Stats and abilities come from the source variety; form types use pokemon_form_types.",
    hintSql: "AND (f.is_species_default = 1 OR f.is_mega = 1)",
    sql: `SELECT f.name, p.generation_id AS species_generation,
       f.introduced_generation_id AS form_generation,
       f.attack, f.special_attack, f.total_stats
FROM pokemon p
JOIN pokemon_forms f ON f.species_id = p.id
WHERE p.name = 'Charizard'
  AND (f.is_species_default = 1 OR f.is_mega = 1)
ORDER BY f.id;`,
  },
];
