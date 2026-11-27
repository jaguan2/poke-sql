import * as terrain from "./terrain";
import type { Position, Direction } from "../zones";

export type MovementMode = "walking" | "running" | "surfing";
export const SPEEDS: Record<MovementMode, number> = { walking: 3, running: 5, surfing: 4 };
const cell = (p: Position) => ({ x: Math.floor(p.x + .5), y: Math.floor(p.y + .5) });
export interface Player {
  mapId: string; position: Position; velocity: Position; direction: Direction;
  mode: MovementMode; elevation: number; distance: number;
  transition?: { from: Position; to: Position; elapsed: number; duration: number; mode: MovementMode; jump: boolean };
}
export interface MovementInput { x: number; y: number; run: boolean; autoSurf: boolean }
export const FOOT_RADIUS = .21;
const delta: Record<Direction, Position> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const planeMode = (mode: MovementMode) => mode === "surfing" ? "surf" : "walk";
export type TerrainMaps = ReadonlyMap<string, terrain.TerrainMap>;

/** Coordinates are in tiles, with integer centers matching legacy saves. */
export function locate(maps: TerrainMaps, id: string, position: Position): { map: terrain.TerrainMap; position: Position; offset: Position } | null {
  const map = maps.get(id);
  if (!map) return null;
  const p = position;
  const side = p.x < -.5 ? "left" : p.x >= map.width - .5 ? "right" : p.y < -.5 ? "up" : p.y >= map.height - .5 ? "down" : undefined;
  if (!side) return { map, position, offset: { x: 0, y: 0 } };
  for (const c of map.connections.filter(c => c.direction === side && c.runtimeDestination)) {
    const other = maps.get(c.runtimeDestination!);
    if (!other) continue;
    const offset = side === "left" ? { x: -other.width, y: c.offset } : side === "right" ? { x: map.width, y: c.offset }
      : side === "up" ? { x: c.offset, y: -other.height } : { x: c.offset, y: map.height };
    const target = { x: position.x - offset.x, y: position.y - offset.y };
    if (target.x >= -.5 && target.y >= -.5 && target.x < other.width - .5 && target.y < other.height - .5) return { map: other, position: target, offset };
  }
  return null;
}

export function canStand(maps: TerrainMaps, id: string, p: Position, mode: MovementMode, elevation: number): boolean {
  for (const x of [-FOOT_RADIUS, FOOT_RADIUS]) for (const y of [-FOOT_RADIUS, FOOT_RADIUS]) {
    const location = locate(maps, id, { x: p.x + x, y: p.y + y });
    if (!location) return false;
    const s = terrain.surface(location.map, cell(location.position), planeMode(mode));
    if (!s.allowed || elevation !== 0 && s.elevation !== 0 && s.elevation !== elevation) return false;
  }
  return true;
}

export function createPlayer(map: terrain.TerrainMap, position: Position, mode: MovementMode = "walking", direction: Direction = "down"): Player {
  const elevation = terrain.surface(map, cell(position), planeMode(mode)).elevation;
  return { mapId: map.id, position: { ...position }, velocity: { x: 0, y: 0 }, direction, mode, elevation, distance: 0 };
}

/** A shoreline action is validated before locking the short mount/dismount. */
export function traverse(player: Player, maps: TerrainMaps): Player {
  if (player.transition) return player;
  const map = maps.get(player.mapId);
  if (!map) return player;
  const at = cell(player.position), d = delta[player.direction];
  const target = { x: at.x + d.x, y: at.y + d.y };
  const mode = player.mode === "surfing" ? "walking" : "surfing";
  const s = terrain.surface(map, target, planeMode(mode));
  // Gen III shorelines meet the ordinary land plane (3); zero is a shared plane.
  const landElevation = mode === "walking" ? s.elevation : player.elevation;
  if (!s.allowed || s.tile === "B" || terrain.terrainAt(map, at) === "B" || ![0, 3].includes(landElevation) || Math.hypot(target.x - player.position.x, target.y - player.position.y) > 1.2
    || !canStand(maps, map.id, target, mode, s.elevation)) return player;
  return { ...player, velocity: { x: 0, y: 0 }, transition: { from: player.position, to: target, elapsed: 0, duration: .22, mode, jump: false } };
}

export function advancePlayer(player: Player, input: MovementInput, elapsed: number, maps: TerrainMaps): Player {
  let p = { ...player, position: { ...player.position }, velocity: { ...player.velocity } };
  let remaining = Math.max(0, Math.min(elapsed, .1));
  while (remaining > 1e-7) {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    if (p.transition) {
      const t = { ...p.transition, elapsed: p.transition.elapsed + dt }, progress = Math.min(1, t.elapsed / t.duration);
      const before = p.position;
      p.position = { x: t.from.x + (t.to.x - t.from.x) * progress, y: t.from.y + (t.to.y - t.from.y) * progress };
      p.distance += Math.hypot(p.position.x - before.x, p.position.y - before.y);
      if (progress === 1) { p.mode = t.mode; p.transition = undefined; p.elevation = terrain.surface(maps.get(p.mapId)!, p.position, planeMode(p.mode)).elevation; }
      else p.transition = t;
      continue;
    }
    const length = Math.hypot(input.x, input.y);
    if (length) p.direction = Math.abs(input.x) > Math.abs(input.y) ? input.x > 0 ? "right" : "left" : input.y > 0 ? "down" : "up";
    if (length && p.mode !== "surfing" && (!input.x || !input.y)) {
      const map = maps.get(p.mapId)!, at = cell(p.position), d = delta[p.direction];
      const ledge = terrain.terrainAt(map, { x: at.x + d.x, y: at.y + d.y });
      const landing = { x: at.x + d.x * 2, y: at.y + d.y * 2 };
      if (ledge === { up: "^", down: "v", left: "<", right: ">" }[p.direction]
        && Math.hypot(p.position.x - at.x, p.position.y - at.y) < .32
        && canStand(maps, p.mapId, landing, p.mode, terrain.surface(map, landing, "walk").elevation)) {
        p.transition = { from: p.position, to: landing, elapsed: 0, duration: .25, mode: p.mode, jump: true };
        p.velocity = { x: 0, y: 0 }; continue;
      }
    }
    if (p.mode !== "surfing") p.mode = input.run ? "running" : "walking";
    const speed = SPEEDS[p.mode], target = { x: length ? input.x / length * speed : 0, y: length ? input.y / length * speed : 0 };
    const decay = Math.exp(-50 * dt);
    const displacement = { x: target.x * dt + (p.velocity.x - target.x) * (1 - decay) / 50,
      y: target.y * dt + (p.velocity.y - target.y) * (1 - decay) / 50 };
    p.velocity = { x: target.x + (p.velocity.x - target.x) * decay, y: target.y + (p.velocity.y - target.y) * decay };
    const before = { ...p.position };
    for (const axis of ["x", "y"] as const) {
      const next = { ...p.position, [axis]: p.position[axis] + displacement[axis] };
      if (canStand(maps, p.mapId, next, p.mode, p.elevation)) p.position = next;
      else p.velocity[axis] = 0;
    }
    p.distance += Math.hypot(p.position.x - before.x, p.position.y - before.y);
    const location = locate(maps, p.mapId, p.position);
    if (location) { p.mapId = location.map.id; p.position = location.position;
      p.elevation = terrain.surface(location.map, { x: Math.floor(p.position.x + .5), y: Math.floor(p.position.y + .5) }, planeMode(p.mode)).elevation; }
    if (length && input.autoSurf) p = traverse(p, maps);
  }
  return p;
}
