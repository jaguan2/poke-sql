export interface SampleQuery {
  title: string;
  sql: string;
}

/** Ordered easiest → hardest. The pokedex view is the friendly flat starting
 *  point; later samples push into joins, self-joins, and window functions. */
export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    title: "Meet the Pokédex",
    sql: "SELECT * FROM pokedex LIMIT 20;",
  },
  {
    title: "Gen 1 fire types",
    sql: `SELECT name, type1, type2, total_stats
FROM pokedex
WHERE generation = 'Generation I'
  AND (type1 = 'fire' OR type2 = 'fire')
ORDER BY total_stats DESC;`,
  },
  {
    title: "Top 10 strongest",
    sql: `SELECT name, type1, type2, total_stats
FROM pokedex
ORDER BY total_stats DESC
LIMIT 10;`,
  },
  {
    title: "Count per generation",
    sql: `SELECT generation, region, COUNT(*) AS pokemon_count,
       SUM(is_legendary) AS legendaries
FROM pokedex
GROUP BY generation, region
ORDER BY MIN(id);`,
  },
  {
    title: "Heaviest legendaries",
    sql: `SELECT name, weight_kg, height_m, type1
FROM pokedex
WHERE is_legendary = 1
ORDER BY weight_kg DESC
LIMIT 10;`,
  },
  {
    title: "What beats Dragon? (joins)",
    sql: `SELECT attacker.name AS attacking_type, m.damage_factor
FROM type_matchups m
JOIN types attacker ON attacker.id = m.attacking_type_id
JOIN types defender ON defender.id = m.defending_type_id
WHERE defender.name = 'dragon' AND m.damage_factor > 1;`,
  },
  {
    title: "Evolution lines (self-join)",
    sql: `SELECT base.name AS stage1, mid.name AS stage2, final.name AS stage3
FROM pokemon base
LEFT JOIN pokemon mid   ON mid.evolves_from_id = base.id
LEFT JOIN pokemon final ON final.evolves_from_id = mid.id
WHERE base.evolves_from_id IS NULL
  AND mid.id IS NOT NULL
ORDER BY base.id
LIMIT 25;`,
  },
  {
    title: "Hidden abilities (many-to-many)",
    sql: `SELECT p.name AS pokemon, a.name AS hidden_ability
FROM pokemon p
JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
JOIN abilities a          ON a.id = pa.ability_id
WHERE pa.is_hidden = 1
ORDER BY p.id
LIMIT 25;`,
  },
  {
    title: "Pure single-type counts",
    sql: `SELECT type1, COUNT(*) AS pure_count
FROM pokedex
WHERE type2 IS NULL
GROUP BY type1
HAVING COUNT(*) >= 10
ORDER BY pure_count DESC;`,
  },
  {
    title: "Fastest per gen (window fn)",
    sql: `-- Note: ORDER BY generation would sort the TEXT alphabetically
-- (putting Generation IX before V!), so we order by generation_id.
SELECT name, generation, speed, rank
FROM (
  SELECT name, generation, generation_id, speed,
         RANK() OVER (PARTITION BY generation ORDER BY speed DESC) AS rank
  FROM pokedex
)
WHERE rank <= 3
ORDER BY generation_id, rank;`,
  },
  {
    title: "Try writing data!",
    sql: `-- The database lives in your browser: experiment freely,
-- then click "Reset DB" to restore it.
UPDATE pokemon SET name = 'MEGA ' || name WHERE id = 150;
SELECT id, name FROM pokemon WHERE id = 150;`,
  },
];
