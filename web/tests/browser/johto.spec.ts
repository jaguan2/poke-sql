import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import type { SafariSession } from '../../src/features/safari/types';
import { regionPortals } from '../../src/features/safari/regions';
import { zoneById, type ZoneId } from '../../src/features/safari/zones';
import { routePath, openSafariQuery } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';

async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click(); }
async function saved(page: Page): Promise<SafariSession> { return page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!)); }
async function choose(page: Page, region: string, area: ZoneId) {
  const map = page.locator('.region-map');
  if (!await map.evaluate(e => (e as HTMLDetailsElement).open)) await map.locator('summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: region, exact: true }).click();
  await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption(area);
}
async function drop(page: Page, region: string, area: ZoneId) {
  await choose(page, region, area);
  await page.getByRole('button', { name: `Travel to ${zoneById(area).name}`, exact: true }).click();
}
async function step(page: Page, direction: string) {
  await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`); await page.waitForTimeout(125);
}

test('choose an unvisited route, forest or cave in any region without awarding a catch, including offline', async ({ page, context }) => {
  await open(page);
  await drop(page, 'Kanto', 'mt-moon-b2f');
  expect(await saved(page)).toMatchObject({ zoneId: 'mt-moon-b2f', position: zoneById('mt-moon-b2f').start, catches: 0, encounter: null });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await drop(page, 'Hoenn', 'route-117');
  await drop(page, 'Johto', 'route-33');
  expect(await saved(page)).toMatchObject({ zoneId: 'route-33', position: { x: 11, y: 9 }, catches: 0, encounter: null });
  await expect(page.locator('.safari-rustle')).toHaveCount(1);
  await drop(page, 'Johto', 'ilex-forest');
  expect(await saved(page)).toMatchObject({ zoneId: 'ilex-forest', position: { x: 3, y: 43 }, catches: 0, encounter: null });
  await expect(page.getByLabel('Music track')).toHaveValue('johto-union-cave');
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Ilex Forest exploration map' })).toBeVisible();
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 480);
});

test('walk from New Bark Town into Route 29, then resume the exact Johto position', async ({ page }) => {
  await open(page); await drop(page, 'Johto', 'new-bark-town');
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  const exit = regionPortals('new-bark-town')[0];
  await page.locator('.safari-map').focus();
  for (const direction of routePath('new-bark-town', { x: 10, y: 9 }, { x: 0, y: exit.y })) await step(page, direction);
  await step(page, 'left');
  await expect(page.getByRole('group', { name: 'Route 29 exploration map' })).toBeVisible();
  await expect(page.getByLabel('Music track')).toHaveValue('johto-route-29');
  const before = await saved(page);
  await drop(page, 'Kanto', 'route-3');
  await choose(page, 'Johto', 'new-bark-town');
  await page.getByRole('button', { name: 'Continue Johto', exact: true }).click();
  expect(await saved(page)).toMatchObject({ zoneId: before.zoneId, position: before.position, direction: before.direction, catches: 0 });
});

test('walking in Slowpoke Well starts an encounter; wrong SQL cannot catch or travel, correct SQL reaches PC', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), { ...createSafariSession('slowpoke-well-b1f'), grassSteps: 5 });
  await open(page); await page.getByRole('button', { name: 'Got it', exact: true }).click();
  const patch = await page.locator('.safari-rustle').evaluate(e => ({ x: Number((e as HTMLElement).dataset.x), y: Number((e as HTMLElement).dataset.y) }));
  await page.locator('.safari-map').focus();
  for (const direction of routePath('slowpoke-well-b1f', (await saved(page)).position, patch)) {
    if ((await saved(page)).encounter) break;
    await step(page, direction);
  }
  await expect(page.getByRole('button', { name: /Catch Pokémon/ })).toBeVisible();
  const encounter = (await saved(page)).encounter!;
  await choose(page, 'Hoenn', 'petalburg-woods');
  await expect(page.getByRole('button', { name: 'Travel to Petalburg Woods', exact: true })).toBeDisabled();
  await page.locator('.region-map > summary').click();
  await openSafariQuery(page);
  await page.locator('.cm-content').fill(`SELECT * FROM pokemon WHERE id = ${encounter.pokemonId};`);
  await page.getByRole('button', { name: /Catch Pokémon/ }).click();
  await expect.poll(async () => (await saved(page)).encounter?.attempts).toBe(1);
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.locator('.cm-content').fill(`SELECT id, name, type1, type2 FROM pokedex WHERE id = ${encounter.pokemonId};`);
  await page.getByRole('button', { name: /Catch Pokémon/ }).click();
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures[0]).toMatchObject({ pokemon: { id: encounter.pokemonId }, location: 'Slowpoke Well B1F', attempts: 2 });
  expect((await saved(page)).catches).toBe(1);
});

test.describe('Johto on iPad', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    test(`area selector and all region labels fit ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport); await open(page);
      await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
      await choose(page, 'Johto', 'route-34');
      const chart = page.getByRole('group', { name: 'Johto region map', exact: true });
      await expect(chart.locator('.region-map-art')).toHaveJSProperty('naturalWidth', 160);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.screenshot({ path: info.outputPath(`johto-ipad-${viewport.width}.png`) });
      await page.getByRole('button', { name: 'Travel to Route 34', exact: true }).tap();
      await expect(page.getByRole('group', { name: 'Route 34 exploration map' })).toBeVisible();
      expect(await saved(page)).toMatchObject({ zoneId: 'route-34', catches: 0, encounter: null });
    });
  }
});
