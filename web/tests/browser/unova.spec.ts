import { test, expect } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { collectionSnapshot } from '../fixtures/pc';

test('retired Unova saves keep their catches and the Unova Pokédex offline without world assets', async ({ page, context }) => {
  const [entry] = await entriesFor([495]);
  const legacy = { ...createSafariSession(), zoneId: 'unova-route-1', position: { x: 9, y: 5 },
    steps: 74, catches: 1, draft: 'SELECT * FROM pokedex WHERE id = 504;',
    lastCatch: { encounterId: 'earned-in-unova', pokemon: entry.pokemon, attempts: 1, caughtAt: '2026-11-26T12:00:00.000Z' },
    encounter: { id: 'unfinished-unova', pokemonId: 504, assignmentId: 'field-notes', attempts: 2, outcome: 'active', fleeAfter: 5 },
    visited: ['pallet-town', 'unova-route-1'],
    regionPositions: { unova: { zoneId: 'nuvema-town', position: { x: 12, y: 9 }, direction: 'up' } },
  };
  const worldRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/safari/unova/')) worldRequests.push(request.url()); });
  await page.addInitScript(session => {
    if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, legacy);
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pallet Town exploration map', exact: true })).toBeVisible();
  await page.locator('.region-map > summary').click();
  await expect(page.getByRole('navigation', { name: 'Regions', exact: true }).getByRole('button')).toHaveText(['Kanto', 'Hoenn', 'Johto', 'Sinnoh']);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
  expect(saved).toMatchObject({ zoneId: 'pallet-town', steps: 74, catches: 1, encounter: null,
    draft: legacy.draft, lastCatch: legacy.lastCatch, retiredUnova: legacy });
  expect(saved.regionPositions).not.toHaveProperty('unova');
  expect((await collectionSnapshot(page)).captures).toMatchObject([{ pokemon: { id: 495, name: 'Snivy' } }]);
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByLabel('Region', { exact: true }).selectOption('5');
  await expect(page.getByText('156 matching Pokémon', { exact: true })).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.getByRole('heading', { name: 'Snivy', exact: true })).toBeVisible();
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByLabel('Region', { exact: true }).selectOption('5');
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.getByRole('heading', { name: 'Snivy', exact: true })).toBeVisible();
  expect(worldRequests).toEqual([]);
  const cachedUnova = await page.evaluate(async () => {
    const urls = (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat();
    return urls.filter(url => url.includes('/safari/unova/'));
  });
  expect(cachedUnova).toEqual([]);
});
