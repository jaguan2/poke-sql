import type { AssignmentId } from "./types";
import type { ZoneId } from "./zones";

const TRACKS: Partial<Record<number, { description: string; filter: string; hint: string }>> = {
  58: {
    description: "A Fire-type from Generation I, shorter than 0.8 m and weighing at least 15 kg.",
    filter: "generation_id = 1 AND type1 = 'fire' AND height_m < 0.8 AND weight_kg >= 15",
    hint: "Start with generation_id and type1. Add height_m and weight_kg one at a time with AND.",
  },
  77: {
    description: "A Fire-type from Generation I, between 0.8 and 1.2 m tall (inclusive), with a base speed of at least 90. It can still evolve.",
    filter: "generation_id = 1 AND type1 = 'fire' AND height_m BETWEEN 0.8 AND 1.2 AND speed >= 90 AND can_evolve = 1",
    hint: "BETWEEN includes both ends of a range. Use it on height_m. The can_evolve column is 1 for a Pokémon that can still evolve.",
  },
  607: {
    description: "A Ghost-type from Generation V with Fire as its second type. It weighs less than 5 kg.",
    filter: "generation_id = 5 AND type1 = 'ghost' AND type2 = 'fire' AND weight_kg < 5",
    hint: "Filter both type1 and type2 before adding the weight_kg condition. Type names are lowercase in the Pokédex.",
  },
};

const SURVEY_POKEMON = 324; // Torkoal
const SURVEY_ROUTE = "WITH route AS (\n  SELECT id, name, speed FROM pokedex\n  WHERE id IN (58, 77, 218, 322, 324, 607, 757, 837)\n)\n";

export function fieldAssignmentId(zoneId: ZoneId, pokemonId: number) {
  if (zoneId !== "volcano") return undefined;
  if (TRACKS[pokemonId]) return "tracking";
  if (pokemonId === SURVEY_POKEMON) return "ranger-survey";
}

export function isFieldAssignment(id: unknown): id is "tracking" | "ranger-survey" {
  return id === "tracking" || id === "ranger-survey";
}

export const fieldAssignmentDraft = (id: AssignmentId) =>
  id === "ranger-survey" ? `${SURVEY_ROUTE}SELECT ` : "SELECT ";

export function trackingAssignment(pokemonId: number) {
  const track = TRACKS[pokemonId];
  if (!track) throw new Error("This tracking assignment could not be restored.");
  return {
    title: "Track the Pokémon", topic: "WHERE · AND",
    prompt: `${track.description} Return the Pokédex id of the one matching Pokémon.`,
    hint: track.hint,
    sql: `SELECT id FROM pokedex\nWHERE ${track.filter};`,
  };
}

export const rangerSurvey = {
  title: "Ranger survey", topic: "ORDER BY · LIMIT",
  prompt: "Help the ranger survey the route before you catch Torkoal. From the eight species in the route query, return name and speed for the three fastest, fastest first. Break ties by lowest Pokédex id.",
  hint: "The starter query defines route for you. Select name and speed from route, sort by speed descending and id ascending, and limit the result to three rows.",
  sql: `${SURVEY_ROUTE}SELECT name, speed FROM route\nORDER BY speed DESC, id ASC\nLIMIT 3;`,
};
