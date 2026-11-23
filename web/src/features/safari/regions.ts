import kantoMaps from "./kanto-maps.json" with { type: "json" };
import kantoRoutes from "./kanto-routes.json" with { type: "json" };
import hoennMaps from "./hoenn-maps.json" with { type: "json" };
import hoennRoutes from "./hoenn-routes.json" with { type: "json" };
import johtoMaps from "./johto-maps.json" with { type: "json" };
import johtoRoutes from "./johto-routes.json" with { type: "json" };
import type { Direction, Position, SafariZoneDefinition, ZoneId } from "./zones";

const maps = { ...kantoMaps, ...hoennMaps, ...johtoMaps };
export type RegionId = "kanto" | "hoenn" | "johto";
export type RegionLocationId = keyof typeof maps;
interface RouteRecipe {
  name: string; kind: string; description: string; pool: (string | number)[][];
  overview?: boolean; landmark?: string;
}
const routes: Readonly<Record<RegionLocationId, RouteRecipe>> = { ...kantoRoutes, ...hoennRoutes, ...johtoRoutes };
export const isRegionLocation = (id: unknown): id is RegionLocationId => typeof id === "string" && Object.prototype.hasOwnProperty.call(routes, id);
export const regionalRoute = (id: ZoneId) => isRegionLocation(id) ? routes[id] : undefined;
interface RegionPortal extends Position { to: RegionLocationId; arrival: Position }
export const regionPortals = (id: ZoneId): readonly RegionPortal[] => isRegionLocation(id) ? maps[id].portals as RegionPortal[] : [];
export const DIRECTION_STEP: Record<Direction, Position> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function locations(ids: readonly RegionLocationId[], regionName: string): readonly SafariZoneDefinition[] {
  return ids.map(id => {
    const route = routes[id], map = maps[id], cave = route.kind === "cave";
    return {
      id, name: route.name, routeName: route.name, subtitle: regionName, description: route.description, music: map.music,
      accent: cave ? "#ddc4a3" : "#bedfc1", ground: cave ? "#9e8267" : "#8fbc8f", canopy: cave ? "#665348" : "#315e48",
      icon: route.kind === "town" ? "⌂" : cave ? "◇" : route.kind === "forest" ? "♧" : "↟",
      encounterTerrain: cave ? "stone" : "grass", weather: ["clear"], battleTerrain: cave ? "cave" : "grass",
      map: map.rows, start: map.start, rustle: map.rustle ?? map.start,
      species: route.pool.map(([speciesId, name, weight]) => ({ id: Number(speciesId), name: String(name), weight: Number(weight),
        rarity: Number(weight) <= 10 ? "Rare" : Number(weight) <= 25 ? "Uncommon" : "Common", favoredWeather: [] })),
    };
  });
}
export const KANTO_LOCATIONS = locations(Object.keys(kantoRoutes) as RegionLocationId[], "Kanto");
export const HOENN_LOCATIONS = locations(Object.keys(hoennRoutes) as RegionLocationId[], "Hoenn");
export const JOHTO_LOCATIONS = locations(Object.keys(johtoRoutes) as RegionLocationId[], "Johto");
interface RegionDefinition { id: RegionId; name: string; start: RegionLocationId; locations: readonly SafariZoneDefinition[] }
export const REGIONS: readonly RegionDefinition[] = [
  { id: "kanto", name: "Kanto", start: "pallet-town", locations: KANTO_LOCATIONS },
  { id: "hoenn", name: "Hoenn", start: "littleroot-town", locations: HOENN_LOCATIONS },
  { id: "johto", name: "Johto", start: "new-bark-town", locations: JOHTO_LOCATIONS },
];
export const regionById = (id: RegionId): RegionDefinition => REGIONS.find(region => region.id === id)!;
export const regionFor = (id: ZoneId): RegionDefinition | undefined => REGIONS.find(region => region.locations.some(location => location.id === id));
export const isRegionId = (id: unknown): id is RegionId => REGIONS.some(region => region.id === id);

/** Native edge crossings and door/ladder steps share the same next-tile trigger. */
export function regionTravel(id: ZoneId, position: Position, direction: Direction): RegionPortal | undefined {
  const delta = DIRECTION_STEP[direction];
  return regionPortals(id).find(portal => portal.x === position.x + delta.x && portal.y === position.y + delta.y);
}
