import type { CSSProperties } from "react";
import metadata from "./route-trainers.json";
import sinnohTrainers from "./sinnoh-trainers.json";
import { framePosition } from "../../shared/trainer/profile";

const locations: Readonly<Record<string, readonly { x: number; y: number; kind: string; facing: string }[]>> = { ...metadata.locations, ...sinnohTrainers };
const sprites: Readonly<Record<string, { file: string }>> = metadata.sprites;
const frames: Readonly<Record<string, number>> = { down: 0, up: 1, left: 2, right: 3 };

/** Decorative trainers do not change collisions or encounters. */
export function RouteTrainers({ zoneId, position }: { zoneId: string; position: (x: number, y: number) => CSSProperties }) {
  return (locations[zoneId] ?? []).map(npc => <span key={`${npc.x}-${npc.y}`} className="safari-route-trainer" aria-hidden="true"
    data-x={npc.x} data-y={npc.y} data-kind={npc.kind} style={{ ...position(npc.x, npc.y),
      backgroundImage: `url('${import.meta.env.BASE_URL}safari/${sprites[npc.kind].file}')`,
      backgroundPosition: framePosition(frames[npc.facing], { columns: 4, rows: 1 }) }} />);
}
