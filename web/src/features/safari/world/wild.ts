import { encounterTable, rollEncounter, waterSpecies, weatherFor, type Position, type SafariZoneDefinition } from "../zones";
import { canStand, type Player } from "./physics";
import { surface, terrainAt, type TerrainMap } from "./terrain";

export interface WildPokemon {
  id: string; pokemonId: number; name: string; position: Position; home: Position;
  aquatic: boolean; elevation: number; state: "idle" | "wander" | "encounter";
}
export function hash(text: string) {
  let n = 2166136261;
  for (const letter of text) n = Math.imul(n ^ letter.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function spawnWild(map: TerrainMap, zone: SafariZoneDefinition, player: Player, seed: string, date: string): WildPokemon[] {
  const aquatic = player.mode === "surfing", mode = aquatic ? "surf" : "walk";
  const table = aquatic ? { rows: waterSpecies.map(pokemon => ({ pokemon, weight: pokemon.weight })), totalWeight: waterSpecies.reduce((n, p) => n + p.weight, 0) }
    : encounterTable(zone, weatherFor(zone, date), undefined, date);
  if (!table.rows.length) return [];
  const start = { x: Math.floor(player.position.x + .5), y: Math.floor(player.position.y + .5) };
  const seen = new Set([`${start.x},${start.y}`]), queue = [start], candidates: Position[] = [];
  for (const point of queue) {
    const distance = Math.hypot(point.x - player.position.x, point.y - player.position.y);
    if (distance > 8) continue;
    const s = surface(map, point, mode);
    if (distance > 1.5 && distance < 7 && (aquatic || terrainAt(map, point) === "g")) candidates.push(point);
    if (seen.size > 600) break;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const next = { x: point.x + dx, y: point.y + dy }, key = `${next.x},${next.y}`, target = surface(map, next, mode);
      if (!seen.has(key) && target.allowed && (!s.elevation || !target.elevation || s.elevation === target.elevation)) { seen.add(key); queue.push(next); }
    }
  }
  const selected: Position[] = [];
  candidates.sort((a, b) => Math.hypot(a.x - player.position.x, a.y - player.position.y) - Math.hypot(b.x - player.position.x, b.y - player.position.y));
  for (const point of candidates) {
    if (selected.every(p => Math.hypot(p.x - point.x, p.y - point.y) > 2)) selected.push(point);
    if (selected.length === 3) break;
  }
  return selected.map((point, index) => {
    const pokemon = rollEncounter(table, hash(`${seed}:${index}`) / 2 ** 32);
    return { id: `wild:${zone.id}:${hash(seed)}:${index}`, pokemonId: pokemon.id, name: pokemon.name,
      position: { ...point }, home: point, aquatic, elevation: surface(map, point, mode).elevation, state: "idle" };
  });
}

export function wanderWild(entity: WildPokemon, map: TerrainMap, seconds: number, dt: number): void {
  if (entity.state === "encounter") return;
  const phase = Math.floor(seconds / 2.5), roll = hash(`${entity.id}:${phase}`);
  if (roll % 3 === 0) { entity.state = "idle"; return; }
  const [dx, dy] = [[0, 1], [0, -1], [1, 0], [-1, 0]][roll % 4];
  const next = { x: entity.position.x + dx * dt * .45, y: entity.position.y + dy * dt * .45 };
  const cell = { x: Math.floor(next.x + .5), y: Math.floor(next.y + .5) };
  if (Math.hypot(next.x - entity.home.x, next.y - entity.home.y) < 1.5
    && (entity.aquatic || terrainAt(map, cell) === "g")
    && canStand(new Map([[map.id, map]]), map.id, next, entity.aquatic ? "surfing" : "walking", entity.elevation)) {
    entity.position = next; entity.state = "wander";
  } else entity.state = "idle";
}

export function canInteract(player: Player, entity: WildPokemon, map: TerrainMap): boolean {
  if (player.transition || entity.state === "encounter" || player.elevation !== entity.elevation
    || (player.mode === "surfing") !== entity.aquatic || Math.hypot(player.position.x - entity.position.x, player.position.y - entity.position.y) > 1.6) return false;
  const maps = new Map([[map.id, map]]);
  for (let t = 0; t <= 1; t += .1) {
    if (!canStand(maps, map.id, { x: player.position.x + (entity.position.x - player.position.x) * t,
      y: player.position.y + (entity.position.y - player.position.y) * t }, player.mode, player.elevation)) return false;
  }
  return true;
}
