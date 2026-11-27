import manifest from "../world-assets.json" with { type: "json" };
import { parseWorldTilemap, type WorldTilemap } from "./tilemap";
import { parseTerrain, type TerrainMap } from "./terrain";

interface MapEntry { tilemap: string; metadata: string; width: number; height: number }
const maps: Readonly<Record<string, MapEntry>> = manifest.maps;
export const hasWorldMap = (id: string) => Object.prototype.hasOwnProperty.call(maps, id);
export interface WorldAsset { map: WorldTilemap; atlas: HTMLImageElement; bytes: number; terrain?: TerrainMap }
type Loader = (id: string, signal: AbortSignal) => Promise<WorldAsset>;
interface Entry {
  id: string; serial: number; controller: AbortController; promise: Promise<WorldAsset>;
  users: number; preloaders: number; used: number; asset?: WorldAsset;
}

async function loadWorldAsset(id: string, signal: AbortSignal): Promise<WorldAsset> {
  const entry = maps[id];
  if (!entry) throw new Error("World map unavailable");
  const url = new URL(`${import.meta.env.BASE_URL}safari/${entry.tilemap}`, window.location.href);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("World tilemap unavailable");
  const map = parseWorldTilemap(await response.json(), entry.width, entry.height);
  const metadata = await fetch(new URL(`${import.meta.env.BASE_URL}safari/${entry.metadata}`, window.location.href), { signal });
  if (!metadata.ok) throw new Error("World terrain unavailable");
  const terrain = parseTerrain(await metadata.json(), id, entry.width, entry.height);
  signal.throwIfAborted();
  const image = new Image();
  // Removing the source cancels an in-flight decode when a queued neighbor is
  // evicted. The map itself never uses a remote image or network fallback.
  const abort = () => image.removeAttribute("src");
  signal.addEventListener("abort", abort, { once: true });
  try {
    image.src = new URL(map.tilesets[0].image, url).href;
    await image.decode();
    signal.throwIfAborted();
    const atlas = map.tilesets[0];
    if (image.naturalWidth !== atlas.imagewidth || image.naturalHeight !== atlas.imageheight) throw new Error("World atlas dimensions differ");
    // Estimate decoded RGBA pixels, three numeric GID arrays and elevations, not PNG
    // transfer size. Canvas surfaces are owned by the mounted view, not cached.
    return { map, atlas: image, terrain, bytes: image.naturalWidth * image.naturalHeight * 4 + map.width * map.height * 4 * 8 };
  } finally { signal.removeEventListener("abort", abort); }
}

/** LRU cache of decoded assets. Visible views are pinned; neighbors are evictable. */
export class WorldAssetCache {
  private entries = new Map<string, Entry>();
  private clock = 0;
  constructor(private loader: Loader = loadWorldAsset, private maxEntries = 6, private maxBytes = 12 * 1024 * 1024) {}

  get snapshot() {
    return { entries: this.entries.size, decodedBytes: [...this.entries.values()].reduce((sum, entry) => sum + (entry.asset?.bytes ?? 0), 0) };
  }

  acquire(id: string) {
    const entry = this.get(id);
    entry.users++;
    this.trim();
    let released = false;
    return { promise: entry.promise, release: () => {
      if (released) return;
      released = true;
      entry.users--;
      if (!entry.users && !entry.preloaders && !entry.asset) this.remove(entry);
      this.trim();
    } };
  }

  preload(ids: readonly string[]) {
    const queued = [...new Set(ids)].filter(hasWorldMap).map(id => {
      const entry = this.get(id);
      entry.preloaders++;
      void entry.promise.catch(() => {}); // Failures are removed; visible entry retries.
      this.trim();
      return { id, serial: entry.serial };
    });
    let canceled = false;
    return () => {
      if (canceled) return;
      canceled = true;
      for (const { id, serial } of queued) {
        const entry = this.entries.get(id);
        if (entry?.serial !== serial) continue;
        entry.preloaders--;
        if (!entry.users && !entry.preloaders && !entry.asset) this.remove(entry);
      }
    };
  }

  private get(id: string): Entry {
    const existing = this.entries.get(id);
    if (existing) { existing.used = ++this.clock; return existing; }
    const controller = new AbortController();
    const entry: Entry = { id, serial: ++this.clock, used: this.clock, users: 0, preloaders: 0, controller,
      promise: Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return this.loader(id, controller.signal);
      }).then(asset => {
        controller.signal.throwIfAborted();
        entry.asset = asset;
        this.trim();
        return asset;
      }).catch(error => { this.remove(entry); throw error; }),
    };
    this.entries.set(id, entry);
    return entry;
  }

  private remove(entry: Entry) {
    if (this.entries.get(entry.id) !== entry) return;
    this.entries.delete(entry.id);
    entry.controller.abort();
  }

  private trim() {
    while (this.entries.size > this.maxEntries || this.snapshot.decodedBytes > this.maxBytes) {
      const oldest = [...this.entries.values()].filter(entry => !entry.users).sort((a, b) => a.used - b.used)[0];
      if (!oldest) return; // The visible map always takes priority over the cache budget.
      this.remove(oldest);
    }
  }
}

export const worldAssets = new WorldAssetCache();
