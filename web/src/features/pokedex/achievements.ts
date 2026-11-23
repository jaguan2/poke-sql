import type { Database } from "sql.js";
import { readPokemonCatalog } from "../../shared/sql/pokemon-profiles";
import type { PokemonEncounter } from "./encounters";
import type { AchievementCatalog } from "./types";

export interface AchievementTrack {
  id: string;
  title: string;
  count: number;
  total: number;
  milestones: { target: number; earned: boolean }[];
}

// Read only from the original bundled DB during worker initialization. Goals
// cannot change when SQL practice modifies tables, views, types, or species.
export function readAchievementCatalog(db: Database): AchievementCatalog {
  const generations = db.exec(`SELECT g.id, g.name, g.region, COUNT(p.id)
    FROM generations g LEFT JOIN pokemon p ON p.generation_id = g.id
    GROUP BY g.id, g.name, g.region ORDER BY g.id`)[0].values;
  const types = db.exec(`SELECT t.name, COUNT(DISTINCT p.id)
    FROM types t
    LEFT JOIN pokemon_types pt ON pt.type_id = t.id
    LEFT JOIN pokemon p ON p.id = pt.pokemon_id
    GROUP BY t.id, t.name ORDER BY t.name`)[0].values;
  return {
    speciesCount: Number(db.exec('SELECT COUNT(*) FROM pokemon')[0].values[0][0]),
    pokemon: readPokemonCatalog(db),
    generations: generations.map(row => ({ id: Number(row[0]), name: String(row[1]), region: String(row[2]), total: Number(row[3]) })),
    types: types.map(row => ({ name: String(row[0]), total: Number(row[1]) })),
  };
}

function track(id: string, title: string, count: number, total: number, targets: number[]): AchievementTrack {
  return {
    id, title, count, total,
    milestones: [...new Set([...targets, total])].filter(target => target > 0 && target <= total)
      .sort((a, b) => a - b).map(target => ({ target, earned: count >= target })),
  };
}

// Achievements are a projection of collected species, never a separate save.
// Repeated wins, imported saves, and view filters cannot inflate or erase them.
export function collectionAchievements(encounters: PokemonEncounter[], catalog: AchievementCatalog) {
  const seen = new Set<number>();
  const generations = new Map<number, number>();
  const types = new Map<string, number>();
  for (const { pokemon } of encounters) {
    if (seen.has(pokemon.id)) continue;
    seen.add(pokemon.id);
    generations.set(pokemon.generationId, (generations.get(pokemon.generationId) ?? 0) + 1);
    for (const type of new Set([pokemon.type1, pokemon.type2])) {
      if (type !== null) types.set(type, (types.get(type) ?? 0) + 1);
    }
  }
  const overall = track('national', 'Pokédex explorer', seen.size, catalog.speciesCount, [1, 10, 25, 50, 100, 250, 500]);
  const generationTracks = catalog.generations.map(generation => track(`generation-${generation.id}`,
    `Gen ${generation.id} · ${generation.region}`, generations.get(generation.id) ?? 0, generation.total, [10, 25, 50, 100]));
  const typeTracks = catalog.types.map(type => track(`type-${type.name}`,
    `${type.name[0].toUpperCase()}${type.name.slice(1)} collector`, types.get(type.name) ?? 0, type.total, [5, 10, 25, 50, 100]));
  const all = [overall, ...generationTracks, ...typeTracks];
  return {
    overall, generations: generationTracks, types: typeTracks,
    earnedCount: all.reduce((sum, entry) => sum + entry.milestones.filter(milestone => milestone.earned).length, 0),
    milestoneCount: all.reduce((sum, entry) => sum + entry.milestones.length, 0),
  };
}

export type CollectionAchievements = ReturnType<typeof collectionAchievements>;
