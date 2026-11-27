import { useEffect, useRef, useState } from "react";
import { drawWorldLayers } from "./tilemap";
import { hasWorldMap, worldAssets } from "./assets";
import { regionPortals } from "../regions";
import type { ZoneId } from "../zones";

/** Existing flat terrain remains visible until both native layers are ready. */
export function WorldTerrain({ zoneId, width, height }: { zoneId: ZoneId; width: number; height: number }) {
  const ground = useRef<HTMLCanvasElement>(null), foreground = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const supported = hasWorldMap(zoneId);
  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    setReady(false);
    const lease = worldAssets.acquire(zoneId);
    const cancelNeighbors = worldAssets.preload(regionPortals(zoneId).map(portal => portal.to));
    const back = ground.current, front = foreground.current;
    async function load() {
      try {
        const { map, atlas } = await lease.promise;
        if (disposed || !back || !front) return;
        if (map.width !== width || map.height !== height) throw new Error("World map dimensions differ");
        drawWorldLayers(map, atlas, back, front);
        setReady(true);
      } catch {
        // Flat art and walking remain usable after a missing asset or unsupported export.
      }
    }
    void load();
    return () => {
      disposed = true;
      // Let the destination view acquire a pending neighbor in this React
      // commit before canceling background work from the area being left.
      queueMicrotask(cancelNeighbors); lease.release();
      // Release native backing stores when the view leaves an area.
      if (back) back.width = back.height = 0;
      if (front) front.width = front.height = 0;
    };
  }, [zoneId, supported, width, height]);
  if (!supported) return null;
  return <>
    <canvas ref={ground} className="safari-world-ground" data-ready={ready} aria-hidden="true" />
    <canvas ref={foreground} className="safari-world-foreground" data-ready={ready} aria-hidden="true" />
  </>;
}
