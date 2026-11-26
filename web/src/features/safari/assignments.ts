import type { Database } from "sql.js";
import { runStatements } from "../../shared/sql/engine";
import { matchesResults } from "../../shared/sql/compare-results";
import { fieldAssignmentId, isFieldAssignment, rangerSurvey, trackingAssignment } from "./field-assignments";
import type { PokemonProfile } from "../../shared/pokemon/profile";
import type { AssignmentId } from "./types";
import { isSafariSpecies } from "./zones";

export function safariAssignment(id: AssignmentId, pokemon: { id: number; name: string }) {
  if (isFieldAssignment(id)) {
    if (id !== fieldAssignmentId("volcano", pokemon.id)) throw new Error("This field assignment could not be restored.");
    return id === "tracking" ? trackingAssignment(pokemon.id) : rangerSurvey;
  }
  const where = `WHERE id = ${pokemon.id}`;
  const assignments = {
    "field-notes": { title: "Field notes", topic: "SELECT · WHERE", prompt: `Find ${pokemon.name}. Return id, name, type1, and type2, in that order, for this species only. Keep a missing second type as NULL.`, hint: "Use the pokedex view and filter by the National Dex number or exact name.",
      sql: `SELECT id, name, type1, type2\nFROM pokedex\n${where};` },
    "stat-scan": { title: "Stat scan", topic: "Choosing columns", prompt: `Scan ${pokemon.name}'s stats. Return name, hp, attack, and speed, in that order, for this species only.`, hint: "Choose the four requested columns from pokedex, then filter the matching row.",
      sql: `SELECT name, hp, attack, speed\nFROM pokedex\n${where};` },
    "type-tracker": { title: "Type tracker", topic: "JOIN · ORDER BY", prompt: `Record every type for ${pokemon.name}. Return its name, type name, and type slot, in that order. Sort by slot ascending.`, hint: "Join pokemon to pokemon_types on pokemon_id, then join types on type_id. Filter p.id and sort pt.slot.",
      sql: `SELECT p.name, t.name AS type, pt.slot\nFROM pokemon p\nJOIN pokemon_types pt ON pt.pokemon_id = p.id\nJOIN types t ON t.id = pt.type_id\nWHERE p.id = ${pokemon.id}\nORDER BY pt.slot;` },
    "ability-survey": { title: "Ability survey", topic: "Many-to-many JOIN", prompt: `Survey ${pokemon.name}'s abilities. Return its name, each ability name, and is_hidden, in that order. Sort by is_hidden, then ability name, both ascending.`, hint: "Join pokemon → pokemon_abilities → abilities. Keep normal and hidden abilities.",
      sql: `SELECT p.name, a.name AS ability, pa.is_hidden\nFROM pokemon p\nJOIN pokemon_abilities pa ON pa.pokemon_id = p.id\nJOIN abilities a ON a.id = pa.ability_id\nWHERE p.id = ${pokemon.id}\nORDER BY pa.is_hidden, a.name;` },
  };
  const assignment = assignments[id];
  if (!assignment) throw new Error("This Safari assignment could not be restored. Return to the trail and try again.");
  return { ...assignment,
    prompt: `Catch ${pokemon.name} by returning its full Pokédex entry with an exact name filter. Optional task: ${assignment.prompt}`,
    hint: `Put the name in single quotes: WHERE name = '${pokemon.name.replace(/'/g, "''")}'. ${assignment.hint}`,
  };
}

export function checkSafariQuery(db: Database, sql: string, pokemonId: number, assignmentId: AssignmentId) {
  if (!isSafariSpecies(pokemonId)) throw new Error("This Safari assignment could not be restored. Return to the trail and try again.");
  const row = db.exec("SELECT id, name, type1, type2, generation_id, height_m, weight_kg FROM pokedex WHERE id = ?", [pokemonId])[0]?.values[0];
  if (!row) throw new Error("This Pokémon is missing from the original Pokédex.");
  const pokemon: PokemonProfile = { id: Number(row[0]), name: String(row[1]), type1: String(row[2]), type2: row[3] === null ? null : String(row[3]), generationId: Number(row[4]), heightM: Number(row[5]), weightKg: Number(row[6]) };
  const results = runStatements(db, sql, true);
  const assignment = safariAssignment(assignmentId, pokemon);
  const expected = assignmentId === "tracking"
    ? [{ columns: ["id"], values: [[pokemon.id]], truncated: false }]
    : runStatements(db, assignment.sql, true);
  const fullEntry = isFieldAssignment(assignmentId) ? undefined
    : runStatements(db, `SELECT * FROM pokedex WHERE id = ${pokemon.id};`, true);
  const passed = matchesResults(results, expected, true) || (fullEntry !== undefined && matchesResults(results, fullEntry, true));
  const actual = results[0];
  const target = fullEntry && actual?.columns.length === fullEntry[0].columns.length ? fullEntry[0] : expected[0];
  const safariFeedback = passed ? undefined : !actual || actual.columns.length !== target.columns.length
    ? `Return exactly ${target.columns.length} columns in the requested order.`
    : actual.values.length !== target.values.length ? `Return ${target.values.length} ${target.values.length === 1 ? "row" : "rows"}; your query returned ${actual.values.length}${actual.truncated ? "+" : ""}. Check your filters and joins.`
      : assignmentId === "tracking" ? "That ID does not match the sighting. Compare the result with the clues."
        : "The returned values or row order do not match. Check column order, NULLs, filters, and sorting.";
  return { results, passed, safariPokemon: pokemon, safariFeedback };
}
