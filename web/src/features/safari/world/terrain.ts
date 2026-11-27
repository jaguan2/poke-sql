import type { Direction, Position } from "../zones";

export type MovementMode = "walk" | "run" | "surf";
export interface WorldConnection { direction: Direction; offset: number; runtimeDestination: string | null }
export interface TerrainMap {
  id: string; width: number; height: number; rows: readonly string[]; elevation: readonly number[];
  connections: readonly WorldConnection[];
}
export const tilePoint = (p: Position): Position => ({ x: Math.floor(p.x + .5), y: Math.floor(p.y + .5) });
export const terrainAt = (map: TerrainMap, p: Position) => map.rows[p.y]?.[p.x] ?? "#";
export function surface(map: TerrainMap, point: Position, mode: MovementMode) {
  const tile = terrainAt(map, point);
  const allowed = mode === "surf" ? "~B".includes(tile) : ".gBs".includes(tile);
  return { allowed, elevation: mode === "surf" ? 1 : map.elevation[point.y * map.width + point.x] ?? 0, tile };
}
export function parseTerrain(value: unknown, id: string, width: number, height: number): TerrainMap {
  const data = value as { runtimeId: string; terrain: { version: number; rows: string[] }; cells: { elevation: number[] }; connections: WorldConnection[] };
  if (!data || data.runtimeId !== id || data.terrain?.version !== 1 || !Array.isArray(data.terrain.rows)
    || data.terrain.rows.length !== height || data.terrain.rows.some(row => typeof row !== "string" || row.length !== width || /[^.g~#Bsi><^v]/.test(row))
    || !Array.isArray(data.cells?.elevation) || data.cells.elevation.length !== width * height
    || data.cells.elevation.some(n => !Number.isInteger(n) || n < 0 || n > 15) || !Array.isArray(data.connections)
    || data.connections.some(c => !["up", "down", "left", "right"].includes(c.direction) || !Number.isInteger(c.offset)
      || c.runtimeDestination !== null && typeof c.runtimeDestination !== "string")) throw new Error("Invalid overworld terrain");
  return { id, width, height, rows: data.terrain.rows, elevation: data.cells.elevation, connections: data.connections };
}
