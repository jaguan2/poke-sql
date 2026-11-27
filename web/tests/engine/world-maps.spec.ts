import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseWorldTilemap } from '../../src/features/safari/world/tilemap';
import manifest from '../../src/features/safari/world-assets.json' with { type: 'json' };
import kanto from '../../src/features/safari/kanto-routes.json' with { type: 'json' };
import hoenn from '../../src/features/safari/hoenn-routes.json' with { type: 'json' };

const sample = () => JSON.parse(readFileSync('public/safari/worlds/kanto/pallet-town.tmj', 'utf8'));

test('every existing Kanto and Hoenn outdoor location has a compatible layered export', () => {
  const expected = Object.entries({ ...kanto, ...hoenn }).filter(([, recipe]) => ['town', 'route', 'forest'].includes(recipe.kind)).map(([id]) => id);
  expect(Object.keys(manifest.maps).sort()).toEqual(expected.sort());
  expect(expected).toHaveLength(23);
  for (const entry of Object.values(manifest.maps)) {
    const value = JSON.parse(readFileSync(`public/safari/${entry.tilemap}`, 'utf8'));
    expect(parseWorldTilemap(value, entry.width, entry.height).layers).toHaveLength(3);
  }
});

test('the visual adapter rejects incompatible map grids and unsupported atlas references', () => {
  const map = sample();
  expect(parseWorldTilemap(map, 24, 20).layers.map(layer => layer.name)).toEqual(['ground', 'details', 'foreground']);
  expect(() => parseWorldTilemap(map, 25, 20)).toThrow();
  for (const image of ['https://example.com/tiles.png', '../tiles.png', '/tiles.png']) {
    const changed = sample(); changed.tilesets[0].image = image;
    expect(() => parseWorldTilemap(changed, 24, 20)).toThrow('atlas');
  }
  const flipped = sample(); flipped.layers[0].data[0] = 0x80000001;
  expect(() => parseWorldTilemap(flipped, 24, 20)).toThrow('layer');
  const missing = sample(); missing.layers[2].data.pop();
  expect(() => parseWorldTilemap(missing, 24, 20)).toThrow('layer');
});
