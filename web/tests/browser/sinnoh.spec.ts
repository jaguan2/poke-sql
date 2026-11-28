import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import type { SafariSession } from '../../src/features/safari/types';
import { collectionSnapshot } from '../fixtures/pc';
import { openSafariQuery, regionJourney, routePath } from '../fixtures/safari';

async function saved(page: Page): Promise<SafariSession> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
}

async function step(page: Page, direction: string) {
  const previous = (await saved(page)).steps;
  await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`);
  await expect.poll(async () => (await saved(page)).steps).toBe(previous + 1);
}

test('Sinnoh works offline from the atlas through a shiny catch and PC deposit', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => 0;
    const randomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => {
      if (values instanceof Uint16Array && values.length === 1) {
        values[0] = 0;
        return values;
      }
      return randomValues(values);
    };
  });
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('.region-map > summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: 'Sinnoh', exact: true }).click();
  await page.getByRole('button', { name: 'Travel to Twinleaf Town', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open PC Boxes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  const town = await saved(page);
  const journey = regionJourney(town.zoneId, town.position, 'route-201');
  await page.locator('.safari-map').focus();
  for (const direction of journey.path!) await step(page, direction);

  await expect(page.getByRole('group', { name: 'Route 201 exploration map', exact: true })).toBeVisible();
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 640);
  const table = page.getByRole('table', { name: 'Route 201 encounter table' });
  await expect(table.locator('.safari-silhouette')).toHaveCount(3);
  const route = await saved(page);
  const patch = await page.locator('.safari-rustle').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.x), y: Number((element as HTMLElement).dataset.y),
  }));
  for (const direction of routePath(route.zoneId, route.position, patch)) {
    await step(page, direction);
    if ((await saved(page)).encounter) break;
  }
  await expect.poll(async () => (await saved(page)).encounter).toMatchObject({ pokemonId: 396, shiny: true });
  const sprite = page.locator('.safari-battle-scene img[src$="/sprites/shiny/396.png"]');
  await expect(sprite).toHaveJSProperty('complete', true);
  await expect(sprite).toHaveJSProperty('naturalWidth', 96);
  await openSafariQuery(page);
  const submit = page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true });
  await page.locator('.cm-content').fill('SELECT id, name, type1, type2 FROM pokedex WHERE id = 399;');
  await submit.click();
  await expect.poll(async () => (await saved(page)).encounter?.attempts).toBe(1);
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.locator('.cm-content').fill('SELECT id, name, type1, type2 FROM pokedex WHERE id = 396;');
  await submit.click();
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures).toMatchObject([
    { pokemon: { id: 396, name: 'Starly' }, shiny: true, location: 'Route 201', attempts: 2 },
  ]);

  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(table.getByRole('row', { name: 'Starly: registered', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Route 201 exploration map', exact: true })).toBeVisible();
  await expect(table.getByRole('row', { name: 'Starly: registered', exact: true })).toBeVisible();
});

test('a nearby Honey Tree starts an immediate offline SQL encounter and can be checked again', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => 0;
    sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
  });
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('.region-map > summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: 'Sinnoh', exact: true }).click();
  await page.getByLabel('Area', { exact: true }).selectOption('eterna-forest');
  await page.getByRole('button', { name: 'Travel to Eterna Forest', exact: true }).click();

  const map = page.getByRole('group', { name: 'Eterna Forest exploration map' });
  const tree = map.getByRole('button', { name: 'Check Honey Tree', exact: true });
  await expect(tree).toBeDisabled();
  await page.getByText('Honey Tree encounters', { exact: true }).click();
  const pool = page.getByRole('table', { name: 'Eterna Forest Honey Tree encounter table' });
  await expect(pool.locator('.safari-silhouette')).toHaveCount(7);
  await map.focus();
  const forest = await saved(page);
  for (const direction of routePath(forest.zoneId, forest.position, { x: 9, y: 8 })) await step(page, direction);
  await expect(tree).toBeEnabled();
  await expect(tree).toHaveText('Check Honey Tree');
  expect((await saved(page)).encounter).toBeNull();
  await page.keyboard.press('Tab');
  await expect(tree).toBeFocused();
  await map.screenshot({ path: info.outputPath('eterna-honey-tree.png') });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeVisible();
  const active = (await saved(page)).encounter!;
  expect(active).toMatchObject({ pokemonId: 412, source: 'honey-tree' });
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);

  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await openSafariQuery(page);
  await page.locator('.cm-content').fill("SELECT * FROM pokedex WHERE name = 'Burmy';");
  await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  expect((await collectionSnapshot(page)).captures).toMatchObject([
    { pokemon: { id: 412, name: 'Burmy' }, location: 'Eterna Forest · Honey Tree' },
  ]);
  await page.getByText('Honey Tree encounters', { exact: true }).click();
  await expect(pool.getByRole('row', { name: 'Burmy: registered', exact: true })).toBeVisible();
  await tree.click();
  await expect.poll(async () => (await saved(page)).encounter?.id).not.toBe(active.id);
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeVisible();
  expect((await saved(page)).encounter).toMatchObject({ outcome: 'active', source: 'honey-tree' });
});

test.describe('Honey Trees on a tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, reducedMotion: 'reduce' });

  test('tap the golden tree beside Route 204 to start the encounter', async ({ page }) => {
    await page.addInitScript(session => {
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
      sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
      Math.random = () => 0;
    }, { ...createSafariSession('route-204'), position: { x: 19, y: 6 } });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore', exact: true }).tap();
    const tree = page.getByRole('button', { name: 'Check Honey Tree', exact: true });
    await expect(tree).toHaveText('Check Honey Tree');
    await tree.tap();
    await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeVisible();
    expect((await saved(page)).encounter).toMatchObject({ pokemonId: 412, source: 'honey-tree' });
  });
});
