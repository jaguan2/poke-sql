import { test, expect } from '@playwright/test';
import { areaTrack } from '../../src/features/music/catalog';
import { zoneById } from '../../src/features/safari/zones';

test('all fifteen Kanto maps resolve their original FireRed theme, including shared towns, gates and cave floors', () => {
  const expected = {
    'pallet-town': 'kanto/pallet-town.mp3', 'route-1': 'kanto/route-1.mp3', 'route-2': 'kanto/route-1.mp3',
    'viridian-city': 'kanto/pewter-city.mp3', 'pewter-city': 'kanto/pewter-city.mp3',
    'forest-south-gate': 'kanto/pewter-city.mp3', 'forest-north-gate': 'kanto/pewter-city.mp3',
    'viridian-forest': 'kanto/viridian-forest.mp3',
    'route-22': 'kanto/route-3.mp3', 'route-3': 'kanto/route-3.mp3', 'route-4': 'kanto/route-3.mp3',
    'mt-moon-1f': 'kanto/mt-moon.mp3', 'mt-moon-b1f': 'kanto/mt-moon.mp3', 'mt-moon-b2f': 'kanto/mt-moon.mp3',
    'cerulean-city': 'kanto/cerulean-city.mp3',
  } as const;
  for (const [id, file] of Object.entries(expected)) expect(areaTrack(zoneById(id as keyof typeof expected).music)?.file, id).toBe(file);
  expect(areaTrack(zoneById('forest').music)).toBeUndefined();
  expect(areaTrack('unknown')).toBeUndefined();
});
