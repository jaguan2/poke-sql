import { changeSafariZone, createSafariSession } from '../../src/features/safari/model';
import { isWalkable, movePosition, zoneById, type Direction, type Position, type ZoneId } from '../../src/features/safari/zones';

export function nearSafariGrass(zoneId: ZoneId = 'forest') {
  const zone = zoneById(zoneId);
  return { ...changeSafariZone(createSafariSession(), zoneId), position: { x: zone.rustle.x + 1, y: zone.rustle.y } };
}

export function routePath(zoneId: ZoneId, from: Position, to: Position): Direction[] {
  const zone = zoneById(zoneId);
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [{ position: from, path: [] as Direction[] }];
  for (const entry of queue) {
    if (entry.position.x === to.x && entry.position.y === to.y) return entry.path;
    for (const direction of ['up', 'left', 'down', 'right'] as const) {
      const position = movePosition(zone, entry.position, direction);
      const key = `${position.x},${position.y}`;
      if (isWalkable(zone, position) && !seen.has(key)) {
        seen.add(key); queue.push({ position, path: [...entry.path, direction] });
      }
    }
  }
  throw new Error(`No walking route from ${JSON.stringify(from)} to ${JSON.stringify(to)} in ${zoneId}`);
}
