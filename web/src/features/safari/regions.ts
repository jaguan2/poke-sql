import kantoMaps from "./kanto-maps.json" with { type: "json" };
import kantoRoutes from "./kanto-routes.json" with { type: "json" };
import hoennMaps from "./hoenn-maps.json" with { type: "json" };
import hoennRoutes from "./hoenn-routes.json" with { type: "json" };
import johtoMaps from "./johto-maps.json" with { type: "json" };
import johtoRoutes from "./johto-routes.json" with { type: "json" };
import sinnohMaps from "./sinnoh-maps.json" with { type: "json" };
import sinnohRoutes from "./sinnoh-routes.json" with { type: "json" };
import unovaMaps from "./unova-maps.json" with { type: "json" };
import unovaRoutes from "./unova-routes.json" with { type: "json" };
import honeyPool from "./honey-tree-pool.json" with { type: "json" };
import unovaSpecies from "./unova-species.json" with { type: "json" };
import type { Direction, Position, SafariSpecies, SafariZoneDefinition, ZoneId } from "./zones";

const maps = { ...kantoMaps, ...hoennMaps, ...johtoMaps, ...sinnohMaps, ...unovaMaps };
export type RegionId = "kanto" | "hoenn" | "johto" | "sinnoh" | "unova";
export type RegionLocationId = keyof typeof maps;
interface RouteRecipe {
  name: string; kind: string; description: string; pool: (string | number)[][];
  overview?: boolean; landmark?: string; honeyTree?: Position; supplementalSpecies?: number[];
}
const routes: Readonly<Record<RegionLocationId, RouteRecipe>> = { ...kantoRoutes, ...hoennRoutes, ...johtoRoutes, ...sinnohRoutes, ...unovaRoutes };
export const isRegionLocation = (id: unknown): id is RegionLocationId => typeof id === "string" && Object.prototype.hasOwnProperty.call(routes, id);
export const regionalRoute = (id: ZoneId) => isRegionLocation(id) ? routes[id] : undefined;
interface RegionPortal extends Position { to: RegionLocationId; arrival: Position }
export const regionPortals = (id: ZoneId): readonly RegionPortal[] => isRegionLocation(id) ? maps[id].portals as RegionPortal[] : [];
const portalsByTile = new Map<ZoneId, Map<string, RegionPortal>>();
export const DIRECTION_STEP: Record<Direction, Position> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function recipeSpecies(pool: readonly (string | number)[][]): SafariSpecies[] {
  return pool.map(([speciesId, name, rawWeight]) => {
    const weight = Number(rawWeight);
    return { id: Number(speciesId), name: String(name), weight,
      rarity: weight <= 10 ? "Rare" : weight <= 25 ? "Uncommon" : "Common", favoredWeather: [] };
  });
}

const honeySpecies = recipeSpecies(honeyPool);

function locations(ids: readonly RegionLocationId[], regionName: string): readonly SafariZoneDefinition[] {
  return ids.map(id => {
    const route = routes[id], map = maps[id];
    const cave = route.kind === "cave", snow = route.kind === "snow", lake = route.kind === "lake", sand = route.kind === "sand";
    return {
      id, name: route.name, routeName: route.name, subtitle: regionName, description: route.description, music: map.music,
      accent: cave ? "#ddc4a3" : "#bedfc1", ground: cave ? "#9e8267" : "#8fbc8f", canopy: cave ? "#665348" : "#315e48",
      icon: route.kind === "town" ? "⌂" : cave ? "◇" : route.kind === "forest" ? "♧" : snow ? "❄" : lake ? "≈" : "↟",
      encounterTerrain: cave ? "stone" : snow ? "snow" : sand ? "sand" : "grass", weather: snow ? ["snow"] : ["clear"],
      battleTerrain: cave || snow ? "cave" : lake ? "water" : sand ? "sand" : "grass",
      map: map.rows, start: map.start, rustle: map.rustle ?? map.start,
      layoutRevision: "revision" in map ? Number(map.revision) : 0,
      species: recipeSpecies(route.pool).map(species => {
        const native = unovaSpecies.find(entry => entry.id === species.id);
        return { ...species, rarity: native?.mythical ? "Mythical" as const : native?.legendary ? "Legendary" as const : species.rarity };
      }),
      ...(route.honeyTree ? { honeyTree: { ...route.honeyTree, species: honeySpecies } } : {}),
    };
  });
}
export const KANTO_LOCATIONS = locations(Object.keys(kantoRoutes) as RegionLocationId[], "Kanto");
export const HOENN_LOCATIONS = locations(Object.keys(hoennRoutes) as RegionLocationId[], "Hoenn");
export const JOHTO_LOCATIONS = locations(Object.keys(johtoRoutes) as RegionLocationId[], "Johto");
export const SINNOH_LOCATIONS = locations(Object.keys(sinnohRoutes) as RegionLocationId[], "Sinnoh");
export const UNOVA_LOCATIONS = locations(Object.keys(unovaRoutes) as RegionLocationId[], "Unova");
interface RegionDefinition { id: RegionId; name: string; start: RegionLocationId; locations: readonly SafariZoneDefinition[] }
export const REGIONS: readonly RegionDefinition[] = [
  { id: "kanto", name: "Kanto", start: "pallet-town", locations: KANTO_LOCATIONS },
  { id: "hoenn", name: "Hoenn", start: "littleroot-town", locations: HOENN_LOCATIONS },
  { id: "johto", name: "Johto", start: "new-bark-town", locations: JOHTO_LOCATIONS },
  { id: "sinnoh", name: "Sinnoh", start: "twinleaf-town", locations: SINNOH_LOCATIONS },
  { id: "unova", name: "Unova", start: "nuvema-town", locations: UNOVA_LOCATIONS },
];
export const regionById = (id: RegionId): RegionDefinition => REGIONS.find(region => region.id === id)!;
export const regionFor = (id: ZoneId): RegionDefinition | undefined => REGIONS.find(region => region.locations.some(location => location.id === id));
export const isRegionId = (id: unknown): id is RegionId => REGIONS.some(region => region.id === id);

/** Native edge crossings and door/ladder steps share the same next-tile trigger. */
export function regionTravel(id: ZoneId, position: Position, direction: Direction): RegionPortal | undefined {
  let portals = portalsByTile.get(id);
  if (!portals) {
    portals = new Map();
    for (const portal of regionPortals(id)) {
      const key = `${portal.x},${portal.y}`;
      if (!portals.has(key)) portals.set(key, portal);
    }
    portalsByTile.set(id, portals);
  }
  const delta = DIRECTION_STEP[direction];
  return portals.get(`${position.x + delta.x},${position.y + delta.y}`);
}
