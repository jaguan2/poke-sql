export interface AchievementCatalog {
  speciesCount: number;
  generations: { id: number; name: string; region: string; total: number }[];
  types: { name: string; total: number }[];
}
