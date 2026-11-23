import type { PokemonProfile } from "../../shared/pokemon/profile";

export interface AchievementCatalog {
  speciesCount: number;
  pokemon: PokemonProfile[];
  generations: { id: number; name: string; region: string; total: number }[];
  types: { name: string; total: number }[];
}
