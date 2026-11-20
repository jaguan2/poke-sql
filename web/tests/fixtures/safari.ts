import { createSafariSession } from '../../src/features/safari/model';
import { regionTravel } from '../../src/features/safari/regions';
import { isWalkable, movePosition, zoneById, type Direction, type Position, type ZoneId } from '../../src/features/safari/zones';

export function nearSafariGrass(zoneId: ZoneId = 'forest') {
  const zone = zoneById(zoneId);
  return { ...createSafariSession(zoneId), position: { x: zone.rustle.x + 1, y: zone.rustle.y } };
}

export function regionJourney(id: ZoneId, position: Position, destination: ZoneId) {
  const queue: { id: ZoneId; position: Position; path: Direction[] }[] = [{ id, position, path: [] }];
  const seen = new Set([`${id}:${position.x},${position.y}`]);
  for (const point of queue) for (const direction of ['up', 'down', 'left', 'right'] as const) {
    const portal = regionTravel(point.id, point.position, direction);
    const id = portal?.to ?? point.id;
    const position = portal?.arrival ?? movePosition(zoneById(id), point.position, direction);
    const key = `${id}:${position.x},${position.y}`;
    if (!seen.has(key)) { seen.add(key); queue.push({ id, position, path: [...point.path, direction] }); }
  }
  return { seen, locations: [...new Set(queue.map(p => p.id))].sort(), path: queue.find(p => p.id === destination)?.path };
}

export function routePath(zoneId: ZoneId, from: Position, to: Position): Direction[] {
  const zone = zoneById(zoneId);
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [{ position: from, path: [] as Direction[] }];
  for (const entry of queue) {
    if (entry.position.x === to.x && entry.position.y === to.y) return entry.path;
    for (const direction of ['up', 'left', 'down', 'right'] as const) {
      if (regionTravel(zoneId, entry.position, direction)) continue;
      const position = movePosition(zone, entry.position, direction);
      const key = `${position.x},${position.y}`;
      if (isWalkable(zone, position) && !seen.has(key)) {
        seen.add(key); queue.push({ position, path: [...entry.path, direction] });
      }
    }
  }
  throw new Error(`No walking route from ${JSON.stringify(from)} to ${JSON.stringify(to)} in ${zoneId}`);
}
