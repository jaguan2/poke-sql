interface SqlGuideTopic {
  title: string;
  explanation: string;
  sql: string;
}

export const SQL_GUIDE_TOPICS: readonly SqlGuideTopic[] = [
  {
    title: "SELECT & FROM",
    explanation: "SELECT chooses columns; FROM chooses a table or view. Use * for every column, AS to name an output column, and DISTINCT to remove duplicate result rows. The pokedex view is a friendly starting point.",
    sql: `SELECT name, hp AS health
FROM pokedex
ORDER BY id
LIMIT 10;`,
  },
  {
    title: "WHERE filters",
    explanation: "WHERE keeps rows that match a condition. Combine conditions with AND or OR; parentheses make the grouping explicit. IN matches a list, BETWEEN includes both endpoints, and LIKE uses % for any number of characters and _ for one character.",
    sql: `SELECT name, type1, type2, hp
FROM pokedex
WHERE (type1 = 'water' OR type2 = 'water')
  AND hp >= 80
ORDER BY hp DESC, id
LIMIT 10;`,
  },
  {
    title: "ORDER BY & LIMIT",
    explanation: "ORDER BY sorts ascending (ASC) or descending (DESC). Add a second column to break ties predictably. LIMIT caps the number of rows; OFFSET skips rows after sorting.",
    sql: `SELECT name, speed
FROM pokedex
ORDER BY speed DESC, id ASC
LIMIT 10;`,
  },
  {
    title: "NULL values",
    explanation: "NULL means missing or unknown, rather than zero or an empty string. Test with IS NULL or IS NOT NULL, never = NULL. COALESCE picks the first non-NULL value. COUNT(column) skips NULLs; COUNT(*) counts rows.",
    sql: `SELECT name,
       COALESCE(type2, 'None') AS second_type
FROM pokedex
WHERE type2 IS NULL
ORDER BY id
LIMIT 10;`,
  },
  {
    title: "JOIN tables",
    explanation: "JOIN connects rows using an ON condition. INNER JOIN keeps matches; LEFT JOIN also keeps unmatched left-hand rows, with NULLs on the right. A one-to-many join can produce several rows per Pokémon: this example returns one row per type.",
    sql: `SELECT p.name, t.name AS type
FROM pokemon AS p
JOIN pokemon_types AS pt
  ON pt.pokemon_id = p.id
JOIN types AS t
  ON t.id = pt.type_id
ORDER BY p.id, pt.slot
LIMIT 10;`,
  },
  {
    title: "GROUP BY & HAVING",
    explanation: "GROUP BY collects rows for aggregates such as COUNT, SUM, AVG, MIN, and MAX. WHERE filters rows before grouping; HAVING filters the resulting groups. Group selected columns that are not aggregated.",
    sql: `SELECT type1, COUNT(*) AS pokemon_count,
       ROUND(AVG(hp), 1) AS average_hp
FROM pokedex
WHERE generation_id <= 3
GROUP BY type1
HAVING COUNT(*) >= 10
ORDER BY pokemon_count DESC, type1;`,
  },
  {
    title: "CASE expressions",
    explanation: "CASE creates a value from conditions. The first matching WHEN wins, ELSE supplies a fallback, and END finishes the expression. It can appear in SELECT, ORDER BY, or other expressions.",
    sql: `SELECT name, weight_kg,
       CASE
         WHEN weight_kg >= 100 THEN 'Heavy'
         WHEN weight_kg >= 10 THEN 'Medium'
         ELSE 'Light'
       END AS weight_class
FROM pokedex
ORDER BY id
LIMIT 10;`,
  },
  {
    title: "Subqueries & CTEs",
    explanation: "A subquery is a SELECT inside another query. WITH names a temporary result, called a common table expression (CTE), for that statement only. Use these to break a query into readable steps without creating a table.",
    sql: `WITH strong_pokemon AS (
  SELECT name, total_stats
  FROM pokedex
  WHERE total_stats > (
    SELECT AVG(total_stats) FROM pokedex
  )
)
SELECT name, total_stats
FROM strong_pokemon
ORDER BY total_stats DESC, name
LIMIT 10;`,
  },
  {
    title: "Window functions",
    explanation: "Window functions calculate across related rows without combining them into groups. PARTITION BY defines those sets; ORDER BY inside OVER defines their order. Use a CTE to filter a calculated row number in an outer query.",
    sql: `WITH ranked AS (
  SELECT name, generation_id, speed,
         ROW_NUMBER() OVER (
           PARTITION BY generation_id
           ORDER BY speed DESC, id
         ) AS position
  FROM pokedex
)
SELECT name, generation_id, speed
FROM ranked
WHERE position = 1
ORDER BY generation_id;`,
  },
];
