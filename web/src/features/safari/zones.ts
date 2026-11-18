export type ZoneId = "forest" | "wetlands" | "ridge";
export type Direction = "up" | "down" | "left" | "right";
export interface Position { x: number; y: number }
export interface SafariSpecies { id: number; name: string; weight: number; rarity: "Common" | "Uncommon" | "Rare" }
export interface SafariZoneDefinition {
  id: ZoneId; name: string; subtitle: string; description: string;
  accent: string; ground: string; grass: string; canopy: string;
  map: readonly string[]; start: Position; rustle: Position;
  species: readonly SafariSpecies[];
}

// Fifteen columns by ten rows. Walls/trees (T), water (~) and boulders (R)
// block movement; g is encounter grass; dots and S are safe paths.
const FOREST = [
  "TTTTTTTTTTTTTTT", "Tggggg...gggggT", "Tggggg...gggggT", "Tggggg...gggggT",
  "T.............T", "Tggggg...gggggT", "Tggggg...gggggT", "Tggggg...gggggT",
  "T......S......T", "TTTTTT...TTTTTT",
] as const;
const common = (id: number, name: string): SafariSpecies => ({ id, name, weight: 6, rarity: "Common" });
const uncommon = (id: number, name: string): SafariSpecies => ({ id, name, weight: 3, rarity: "Uncommon" });
const rare = (id: number, name: string): SafariSpecies => ({ id, name, weight: 1, rarity: "Rare" });

export const SAFARI_ZONES: readonly SafariZoneDefinition[] = [
  {
    id: "forest", name: "Verdant Forest", subtitle: "Bug & Grass country",
    description: "Sunlight catches the canopy. Bug Pokémon shelter in the grass, with a few elusive forest neighbours.",
    accent: "#d5ec9b", ground: "#8cb978", grass: "#477f54", canopy: "#285d48",
    map: FOREST, start: { x: 7, y: 8 }, rustle: { x: 4, y: 6 },
    species: [common(10, "Caterpie"), common(13, "Weedle"), common(46, "Paras"), common(48, "Venonat"), uncommon(102, "Exeggcute"), uncommon(114, "Tangela"), uncommon(165, "Ledyba"), uncommon(167, "Spinarak"), rare(123, "Scyther"), rare(25, "Pikachu")],
  },
  {
    id: "wetlands", name: "Willow Wetlands", subtitle: "Water's edge",
    description: "Follow the boardwalk through shallow pools. Water Pokémon gather in the reeds along the banks.",
    accent: "#aae0dc", ground: "#8eafa0", grass: "#477d75", canopy: "#315f60",
    map: ["TTTTTTTTTTTTTTT", "Tggggg...gggggT", "Tggggg...gggggT", "Tgg~~~...~~~ggT", "T..~~~...~~~..T", "Tgg~~~...~~~ggT", "Tggggg...gggggT", "Tggggg...gggggT", "T......S......T", "TTTTTT...TTTTTT"],
    start: { x: 7, y: 8 }, rustle: { x: 4, y: 6 },
    species: [common(54, "Psyduck"), common(60, "Poliwag"), common(79, "Slowpoke"), common(129, "Magikarp"), uncommon(118, "Goldeen"), uncommon(183, "Marill"), uncommon(194, "Wooper"), uncommon(270, "Lotad"), rare(283, "Surskit")],
  },
  {
    id: "ridge", name: "Amber Ridge", subtitle: "Rock & Ground trails",
    description: "Warm stone, winding trails, and hardy grass. Rock and Ground Pokémon make their home on this quiet ridge.",
    accent: "#f1d39b", ground: "#b8aa7c", grass: "#8a9050", canopy: "#796e55",
    map: ["RRRRRRRRRRRRRRR", "Rggggg...gggggR", "RggRgg...ggRggR", "Rggggg...gggggR", "R.............R", "Rggggg...gggggR", "Rggggg...gggggR", "Rggggg...gggggR", "R......S......R", "RRRRRR...RRRRRR"],
    start: { x: 7, y: 8 }, rustle: { x: 4, y: 6 },
    species: [common(74, "Geodude"), common(27, "Sandshrew"), common(111, "Rhyhorn"), common(328, "Trapinch"), uncommon(95, "Onix"), uncommon(304, "Aron"), uncommon(299, "Nosepass"), rare(246, "Larvitar")],
  },
];

export const zoneById = (id: ZoneId): SafariZoneDefinition => SAFARI_ZONES.find(zone => zone.id === id)!;
export const isZoneId = (id: unknown): id is ZoneId => SAFARI_ZONES.some(zone => zone.id === id);
export const tileAt = (zone: SafariZoneDefinition, position: Position): string | undefined => zone.map[position.y]?.[position.x];
export const isWalkable = (zone: SafariZoneDefinition, position: Position): boolean => [".", "g", "S"].includes(tileAt(zone, position) ?? "");
export function movePosition(zone: SafariZoneDefinition, position: Position, direction: Direction): Position {
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  const next = { x: position.x + delta[0], y: position.y + delta[1] };
  return isWalkable(zone, next) ? next : position;
}
export function chooseSpecies(zone: SafariZoneDefinition, roll: number, previousId?: number): SafariSpecies {
  const pool = zone.species.filter(species => species.id !== previousId);
  let remaining = Math.max(0, Math.min(roll, 0.999999)) * pool.reduce((sum, species) => sum + species.weight, 0);
  return pool.find(species => (remaining -= species.weight) < 0) ?? pool[pool.length - 1];
}
export function featuredZone(date: string): ZoneId {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return SAFARI_ZONES[((day % SAFARI_ZONES.length) + SAFARI_ZONES.length) % SAFARI_ZONES.length].id;
}
