import maps from "./maps.json" with { type: "json" };
import { SAFARI_EVENT_VISITORS, safariEvents } from "./events";
import { DIRECTION_STEP, REGIONS, isRegionLocation, regionTravel } from "./regions";
import type { RegionLocationId } from "./regions";
import type { SafariEncounter } from "./types";

export type SafariHabitatId = keyof typeof maps;
export type ZoneId = SafariHabitatId | RegionLocationId;
export type WeatherId = "clear" | "rain" | "fog" | "sandstorm" | "snow" | "sun";
export type Direction = "up" | "down" | "left" | "right";
export interface Position { x: number; y: number }
export interface SafariSpecies { id: number; name: string; weight: number; rarity: "Common" | "Uncommon" | "Rare" | "Legendary" | "Mythical"; favoredWeather: readonly WeatherId[] }
export interface HoneyTree extends Position { species: readonly SafariSpecies[] }
export interface SafariZoneDefinition {
  id: ZoneId; name: string; subtitle: string; description: string;
  accent: string; ground: string; canopy: string; icon: string;
  encounterTerrain: "grass" | "sand" | "stone" | "snow"; weather: readonly WeatherId[];
  battleTerrain: "grass" | "sand" | "cave" | "water";
  map: readonly string[]; start: Position; rustle: Position; routeName: string;
  species: readonly SafariSpecies[];
  honeyTree?: HoneyTree;
  music?: string;
}

// Native route geometry and art are generated together from the pinned game maps.
const common = (id: number, name: string, ...favoredWeather: WeatherId[]): SafariSpecies => ({ id, name, weight: 6, rarity: "Common", favoredWeather });
const uncommon = (id: number, name: string, ...favoredWeather: WeatherId[]): SafariSpecies => ({ id, name, weight: 3, rarity: "Uncommon", favoredWeather });
const rare = (id: number, name: string, ...favoredWeather: WeatherId[]): SafariSpecies => ({ id, name, weight: 1, rarity: "Rare", favoredWeather });

const REGULAR_ZONES: readonly (SafariZoneDefinition & { id: SafariHabitatId })[] = [
  {
    id: "forest", battleTerrain: "grass", name: "Verdant Forest", subtitle: "Bug & Grass country",
    description: "Sunlight catches the canopy. Bug Pokémon shelter in the grass, with a few elusive forest neighbours.",
    icon: "♧", encounterTerrain: "grass", weather: ["clear", "rain", "sun"],
    accent: "#d5ec9b", ground: "#8cb978", canopy: "#285d48",
    map: maps.forest.rows, start: maps.forest.start, rustle: maps.forest.rustle, routeName: maps.forest.name,
    species: [common(10, "Caterpie"), common(13, "Weedle"), common(46, "Paras"), common(48, "Venonat"), uncommon(102, "Exeggcute"), uncommon(114, "Tangela", "sun"), uncommon(165, "Ledyba"), uncommon(167, "Spinarak"), rare(123, "Scyther"), rare(25, "Pikachu", "rain")],
  },
  {
    id: "wetlands", battleTerrain: "grass", name: "Willow Wetlands", subtitle: "Water's edge",
    description: "Follow the bridge and winding banks through shallow pools. Water Pokémon gather in the reeds.",
    icon: "≈", encounterTerrain: "grass", weather: ["rain", "fog"],
    accent: "#aae0dc", ground: "#8eafa0", canopy: "#315f60",
    map: maps.wetlands.rows, start: maps.wetlands.start, rustle: maps.wetlands.rustle, routeName: maps.wetlands.name,
    species: [common(54, "Psyduck"), common(60, "Poliwag", "rain"), common(79, "Slowpoke"), common(129, "Magikarp"), uncommon(118, "Goldeen"), uncommon(183, "Marill"), uncommon(194, "Wooper"), uncommon(270, "Lotad"), rare(283, "Surskit", "rain")],
  },
  {
    id: "ridge", battleTerrain: "grass", name: "Amber Ridge", subtitle: "Rock & Ground trails",
    description: "Warm stone, winding trails, and hardy grass. Rock and Ground Pokémon make their home on this quiet ridge.",
    icon: "◇", encounterTerrain: "grass", weather: ["clear", "sandstorm"],
    accent: "#f1d39b", ground: "#b8aa7c", canopy: "#796e55",
    map: maps.ridge.rows, start: maps.ridge.start, rustle: maps.ridge.rustle, routeName: maps.ridge.name,
    species: [common(74, "Geodude"), common(27, "Sandshrew"), common(111, "Rhyhorn"), common(328, "Trapinch"), uncommon(95, "Onix"), uncommon(304, "Aron"), uncommon(299, "Nosepass"), rare(246, "Larvitar", "sandstorm")],
  },
  {
    id: "meadow", battleTerrain: "grass", name: "Sunlit Meadow", subtitle: "Normal, Flying & Fairy",
    description: "Open grassland and flower borders shelter small mammals, songbirds and shy Fairy types.",
    icon: "✿", encounterTerrain: "grass", weather: ["clear", "sun", "fog"],
    accent: "#e6eda6", ground: "#9fbd75", canopy: "#49784b",
    map: maps.meadow.rows, start: maps.meadow.start, rustle: maps.meadow.rustle, routeName: maps.meadow.name,
    species: [common(831, "Wooloo"), common(661, "Fletchling"), common(427, "Buneary"), common(333, "Swablu"), uncommon(280, "Ralts", "fog"), uncommon(175, "Togepi", "sun"), uncommon(209, "Snubbull"), rare(133, "Eevee", "clear")],
  },
  {
    id: "coast", battleTerrain: "water", name: "Azure Coast", subtitle: "Shoreline Water & Flying",
    description: "A beachside trail winds between parasols, surf and rocky shores. Water Pokémon gather in the sand.",
    icon: "≋", encounterTerrain: "sand", weather: ["clear", "rain"],
    accent: "#b5e8ed", ground: "#d8c08b", canopy: "#3d7c8b",
    map: maps.coast.rows, start: maps.coast.start, rustle: maps.coast.rustle, routeName: maps.coast.name,
    species: [common(278, "Wingull"), common(98, "Krabby"), common(90, "Shellder"), common(72, "Tentacool", "rain"), uncommon(418, "Buizel", "rain"), uncommon(170, "Chinchou"), uncommon(279, "Pelipper"), rare(131, "Lapras", "rain")],
  },
  {
    id: "desert", battleTerrain: "sand", name: "Mirage Dunes", subtitle: "Sand-dwelling Ground & Dragon",
    description: "Windblown sand hides burrowing Pokémon, desert plants and the occasional young Dragon.",
    icon: "⌁", encounterTerrain: "sand", weather: ["sun", "sandstorm"],
    accent: "#f3d58b", ground: "#d6bb78", canopy: "#8f7745",
    map: maps.desert.rows, start: maps.desert.start, rustle: maps.desert.rustle, routeName: maps.desert.name,
    species: [common(551, "Sandile", "sandstorm"), common(328, "Trapinch"), common(27, "Sandshrew"), common(449, "Hippopotas", "sandstorm"), uncommon(331, "Cacnea", "sun"), uncommon(343, "Baltoy"), uncommon(556, "Maractus", "sun"), rare(443, "Gible", "sandstorm")],
  },
  {
    id: "cave", battleTerrain: "cave", name: "Moonstone Caverns", subtitle: "Dark caves & Ghost sightings",
    description: "Stone corridors and underground pools shelter bats, cave dwellers and Ghost types in the mist.",
    icon: "☾", encounterTerrain: "stone", weather: ["clear", "fog"],
    accent: "#cdc4eb", ground: "#8f8271", canopy: "#4c485a",
    map: maps.cave.rows, start: maps.cave.start, rustle: maps.cave.rustle, routeName: maps.cave.name,
    species: [common(41, "Zubat"), common(74, "Geodude"), common(92, "Gastly", "fog"), common(524, "Roggenrola"), uncommon(714, "Noibat"), uncommon(425, "Drifloon", "fog"), uncommon(302, "Sableye", "fog"), rare(633, "Deino")],
  },
  {
    id: "tundra", battleTerrain: "cave", name: "Frostveil Tundra", subtitle: "Snowfields & Ice types",
    description: "Icy tracks lead between frozen pools. Cold-adapted Pokémon roam the snow and crystal outcrops.",
    icon: "❄", encounterTerrain: "snow", weather: ["clear", "snow"],
    accent: "#d3eff7", ground: "#c4dfe5", canopy: "#6d91aa",
    map: maps.tundra.rows, start: maps.tundra.start, rustle: maps.tundra.rustle, routeName: maps.tundra.name,
    species: [common(220, "Swinub"), common(361, "Snorunt", "snow"), common(363, "Spheal"), common(582, "Vanillite", "snow"), uncommon(613, "Cubchoo", "snow"), uncommon(459, "Snover"), uncommon(872, "Snom", "snow"), rare(996, "Frigibax", "snow")],
  },
  {
    id: "volcano", battleTerrain: "cave", name: "Ember Foothills", subtitle: "Volcanic slopes & Fire types",
    description: "Warm ash trails and hot springs attract hardy Fire Pokémon and species that thrive in volcanic foothills.",
    icon: "♨", encounterTerrain: "grass", weather: ["clear", "sun"],
    accent: "#f5c69e", ground: "#b99578", canopy: "#805450",
    map: maps.volcano.rows, start: maps.volcano.start, rustle: maps.volcano.rustle, routeName: maps.volcano.name,
    species: [common(218, "Slugma", "sun"), common(322, "Numel", "sun"), common(58, "Growlithe"), common(77, "Ponyta"), uncommon(607, "Litwick"), uncommon(757, "Salandit", "sun"), uncommon(837, "Rolycoly"), rare(324, "Torkoal", "sun")],
  },
];

export const SAFARI_ZONES = REGULAR_ZONES.map(zone => ({
  ...zone, species: [...zone.species, ...SAFARI_EVENT_VISITORS.filter(visitor => visitor.zoneId === zone.id)],
}));
export const EXPLORATION_LOCATIONS: readonly SafariZoneDefinition[] = [...REGIONS.flatMap(region => region.locations), ...SAFARI_ZONES];

export const zoneById = (id: ZoneId): SafariZoneDefinition => EXPLORATION_LOCATIONS.find(zone => zone.id === id)!;
export const isZoneId = (id: unknown): id is ZoneId => EXPLORATION_LOCATIONS.some(zone => zone.id === id);
export const encounterSpecies = (zone: SafariZoneDefinition, source: SafariEncounter["source"]) =>
  source === "honey-tree" ? zone.honeyTree?.species ?? [] : zone.species;
export const isSafariSpecies = (id: unknown): boolean => EXPLORATION_LOCATIONS.some(zone =>
  zone.species.some(species => species.id === id) || zone.honeyTree?.species.some(species => species.id === id));

export function isBesideHoneyTree(tree: Position, position: Position): boolean {
  const dx = Math.max(tree.x - position.x, position.x - tree.x - 1, 0);
  const dy = Math.max(tree.y - position.y, position.y - tree.y - 1, 0);
  return dx + dy === 1;
}
export const tileAt = (zone: SafariZoneDefinition, position: Position): string | undefined => zone.map[position.y]?.[position.x];
const isIce = (tile: string | undefined) => tile === "i" || tile === "I";
export const isEncounterTile = (tile: string | undefined) => tile === "g" || tile === "I";
export const hasIce = (zone: SafariZoneDefinition) => zone.map.some(row => /[iI]/.test(row));
export function routeCamera(zone: SafariZoneDefinition, position: Position) {
  const width = Math.min(isRegionLocation(zone.id) ? 20 : 15, zone.map[0].length), height = Math.min(isRegionLocation(zone.id) ? 13 : 10, zone.map.length);
  return { width, height,
    x: Math.max(0, Math.min(position.x - Math.floor(width / 2), zone.map[0].length - width)),
    y: Math.max(0, Math.min(position.y - Math.floor(height / 2), zone.map.length - height)) };
}
/** A stable hotspot for this expedition, moving to fresh grass after each catch.
 * Derived from existing saved progress so older sessions need no migration. */
export function rustlingPatch(zone: SafariZoneDefinition, catches: number, position: Position = zone.start): Position | null {
  // Ledges and ice can make individual cells unreachable as stopping points.
  let reachable: Set<string> | undefined;
  if (isRegionLocation(zone.id) || hasIce(zone)) {
    reachable = new Set([`${position.x},${position.y}`]);
    const queue = [position];
    for (const point of queue) for (const direction of ["up", "down", "left", "right"] as const) {
      if (regionTravel(zone.id, point, direction)) continue;
      const next = movePosition(zone, point, direction), key = `${next.x},${next.y}`;
      if (!reachable.has(key)) { reachable.add(key); queue.push(next); }
    }
  }
  const grass = zone.map.flatMap((row, y) => [...row].flatMap((tile, x) => isEncounterTile(tile) && (!reachable || reachable.has(`${x},${y}`)) ? [{ x, y }] : []));
  if (grass.length === 0) return null;
  const start = Math.max(0, grass.findIndex(tile => tile.x === zone.rustle.x && tile.y === zone.rustle.y));
  return grass[(start + (catches % grass.length) * 17) % grass.length];
}
// Crystal's native ledge low bits (0-7) mark walkable floor: jump from the
// current cell. Advance ledges (><^v) instead jump across the next cell.
const FLOOR_LEDGES: Readonly<Record<string, readonly Direction[]>> = {
  "0": ["right"], "1": ["left"], "2": ["up"], "3": ["down"],
  "4": ["right", "down"], "5": ["left", "down"], "6": ["up", "right"], "7": ["up", "left"],
};
const WALKABLE_TILES = [".", "g", "i", "I", "S", "U", ...Object.keys(FLOOR_LEDGES)];
export const isWalkable = (zone: SafariZoneDefinition, position: Position): boolean => WALKABLE_TILES.includes(tileAt(zone, position) ?? "");
function stepPosition(zone: SafariZoneDefinition, position: Position, direction: Direction): Position {
  const delta = DIRECTION_STEP[direction];
  let next = { x: position.x + delta.x, y: position.y + delta.y };
  // U is walkable beside a wall on its north edge; crossing that edge is blocked.
  if (direction === "up" && tileAt(zone, position) === "U" || direction === "down" && tileAt(zone, next) === "U") return position;
  if (FLOOR_LEDGES[tileAt(zone, position) ?? ""]?.includes(direction)) next = { x: next.x + delta.x, y: next.y + delta.y };
  if (tileAt(zone, next) === { up: "^", down: "v", left: "<", right: ">" }[direction]) {
    next = { x: next.x + delta.x, y: next.y + delta.y };
  }
  return isWalkable(zone, next) ? next : position;
}

export function resolveMovement(zone: SafariZoneDefinition, from: Position, direction: Direction) {
  let position = stepPosition(zone, from, direction);
  let steps = position === from ? 0 : 1;
  while (steps > 0 && isIce(tileAt(zone, position)) && !regionTravel(zone.id, position, direction)) {
    const next = stepPosition(zone, position, direction);
    if (next === position) break;
    position = next;
    steps++;
  }
  return { position, steps };
}

export const movePosition = (zone: SafariZoneDefinition, from: Position, direction: Direction) =>
  resolveMovement(zone, from, direction).position;
export function chooseSpecies(zone: SafariZoneDefinition, roll: number, previousId?: number, weather: WeatherId = "clear", date?: string): SafariSpecies {
  return rollEncounter(encounterTable(zone, weather, previousId, date), roll);
}

interface WeightedSpecies { pokemon: SafariSpecies; weight: number }

export function rollEncounter({ rows, totalWeight }: { rows: readonly WeightedSpecies[]; totalWeight: number }, roll: number): SafariSpecies {
  let remaining = Math.max(0, Math.min(roll, 0.999999)) * totalWeight;
  return (rows.find(row => (remaining -= row.weight) < 0) ?? rows[rows.length - 1]).pokemon;
}

function encounterChances(eligible: readonly WeightedSpecies[]) {
  const totalWeight = eligible.reduce((sum, row) => sum + row.weight, 0);
  return { totalWeight, rows: eligible.map(row => ({ ...row, chance: row.weight / totalWeight })) };
}

export const honeyTreeTable = (tree: HoneyTree) =>
  encounterChances(tree.species.map(pokemon => ({ pokemon, weight: pokemon.weight })));

export function encounterTable(zone: SafariZoneDefinition, weather: WeatherId = "clear", previousId?: number, date?: string) {
  const ordinary = zone.species.filter(pokemon => pokemon.weight > 0);
  const eligible = ordinary.filter(pokemon => ordinary.length === 1 || pokemon.id !== previousId)
    .map(pokemon => ({ pokemon, weight: encounterWeight(pokemon, weather) }));
  const ordinaryWeight = eligible.reduce((sum, row) => sum + row.weight, 0);
  const visits = date ? safariEvents(date).filter(event => event.active && event.visitor.zoneId === zone.id
    && event.visitor.id !== previousId && zone.species.some(pokemon => pokemon.id === event.visitor.id)) : [];
  const visitorChance = visits.reduce((sum, event) => sum + event.chance, 0);
  // Scale from the ordinary pool so weather and last-catch exclusions preserve
  // each visitor's advertised probability.
  for (const event of visits) {
    eligible.push({ pokemon: event.visitor, weight: ordinaryWeight * event.chance / (1 - visitorChance) });
  }
  return encounterChances(eligible);
}
export function featuredZone(date: string): ZoneId {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return SAFARI_ZONES[((day % SAFARI_ZONES.length) + SAFARI_ZONES.length) % SAFARI_ZONES.length].id;
}

export const WEATHER: Record<WeatherId, { name: string; icon: string }> = {
  clear: { name: "Clear skies", icon: "☀" }, rain: { name: "Rain", icon: "☂" },
  fog: { name: "Fog", icon: "≋" }, sandstorm: { name: "Sandstorm", icon: "⌁" },
  snow: { name: "Snow", icon: "❄" }, sun: { name: "Strong sunlight", icon: "☀" },
};
export function weatherFor(zone: SafariZoneDefinition, date: string): WeatherId {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const offset = [...zone.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return zone.weather[((day + offset) % zone.weather.length + zone.weather.length) % zone.weather.length];
}
const encounterWeight = (species: SafariSpecies, weather: WeatherId): number => species.weight * (species.favoredWeather.includes(weather) ? 2 : 1);
