import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { WorldAssetCache, type WorldAsset } from '../../src/features/safari/world/assets';
import { parseWorldTilemap } from '../../src/features/safari/world/tilemap';

const map = parseWorldTilemap(JSON.parse(readFileSync('public/safari/worlds/kanto/pallet-town.tmj', 'utf8')), 24, 20);
const asset = (bytes = 40): WorldAsset => ({ map, atlas: {} as HTMLImageElement, bytes });

test('concurrent viewers share a load and released maps are evicted in LRU order', async () => {
  const loads: string[] = [];
  const cache = new WorldAssetCache(async id => { loads.push(id); return asset(); }, 2, 1000);
  const a = cache.acquire('a'), shared = cache.acquire('a');
  expect(a.promise).toBe(shared.promise);
  await a.promise; a.release(); shared.release(); shared.release();
  const b = cache.acquire('b'); await b.promise; b.release();
  const c = cache.acquire('c'); await c.promise; c.release();
  expect(cache.snapshot).toEqual({ entries: 2, decodedBytes: 80 });
  const again = cache.acquire('a'); await again.promise; again.release();
  expect(loads).toEqual(['a', 'b', 'c', 'a']);
});

test('decoded byte budget evicts unpinned assets while the visible map stays usable', async () => {
  const loads: string[] = [];
  const cache = new WorldAssetCache(async id => { loads.push(id); return asset(60); }, 6, 100);
  const current = cache.acquire('pallet-town'); await current.promise;
  const cancel = cache.preload(['route-1', 'viridian-city']);
  // Microtasks resolve the background loads without browser/network dependencies.
  await expect.poll(() => cache.snapshot.entries).toBe(1);
  expect(cache.snapshot).toEqual({ entries: 1, decodedBytes: 60 });
  const shared = cache.acquire('pallet-town');
  expect(shared.promise).toBe(current.promise);
  expect(loads).toEqual(['pallet-town', 'route-1', 'viridian-city']);
  cancel(); shared.release(); current.release();
});

test('leaving an area cancels pending neighbors without aborting its visible asset', async () => {
  const pending = new Map<string, { signal: AbortSignal; resolve: (asset: WorldAsset) => void }>();
  const cache = new WorldAssetCache((id, signal) => new Promise((resolve, reject) => {
    pending.set(id, { signal, resolve });
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const current = cache.acquire('pallet-town');
  const cancel = cache.preload(['route-1', 'viridian-city', 'not-a-world-map']);
  const sharedNeighbor = cache.preload(['route-1']);
  await Promise.resolve();
  cancel();
  expect(pending.get('route-1')!.signal.aborted).toBe(false);
  expect(pending.get('viridian-city')!.signal.aborted).toBe(true);
  expect(pending.get('pallet-town')!.signal.aborted).toBe(false);
  expect(pending.has('not-a-world-map')).toBe(false);
  sharedNeighbor(); sharedNeighbor();
  expect(pending.get('route-1')!.signal.aborted).toBe(true);
  pending.get('pallet-town')!.resolve(asset());
  await current.promise; current.release();
  expect(cache.snapshot).toEqual({ entries: 1, decodedBytes: 40 });
});

test('failed loads are retried and an old cancellation cannot remove a newer request', async () => {
  let calls = 0;
  const pending: { resolve: (asset: WorldAsset) => void; reject: (error: Error) => void }[] = [];
  const cache = new WorldAssetCache(() => { calls++; return new Promise((resolve, reject) => pending.push({ resolve, reject })); });
  const old = cache.acquire('pallet-town');
  const oldRejected = expect(old.promise).rejects.toThrow();
  await Promise.resolve(); old.release();
  const fresh = cache.acquire('pallet-town');
  await Promise.resolve();
  pending[0].reject(new Error('old response'));
  await oldRejected;
  pending[1].resolve(asset());
  await fresh.promise;
  const reused = cache.acquire('pallet-town');
  expect(reused.promise).toBe(fresh.promise);
  expect(calls).toBe(2);
  reused.release(); fresh.release();
});

test('entry limits apply to pending preloads as well as decoded assets', async () => {
  const cache = new WorldAssetCache((_id, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), 2);
  const current = cache.acquire('pallet-town');
  const rejected = expect(current.promise).rejects.toThrow();
  const cancel = cache.preload(['route-1', 'viridian-city', 'route-2', 'route-22']);
  expect(cache.snapshot.entries).toBe(2);
  await Promise.resolve(); cancel(); current.release();
  await rejected;
  expect(cache.snapshot.entries).toBe(0);
});
