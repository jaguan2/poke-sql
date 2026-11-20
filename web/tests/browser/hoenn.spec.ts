import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import type { SafariSession } from '../../src/features/safari/types';
import { regionPortals } from '../../src/features/safari/regions';
import { zoneById } from '../../src/features/safari/zones';
import { routePath, nearSafariGrass } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';

async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click(); }
async function saved(page: Page): Promise<SafariSession> { return page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!)); }
async function switchRegion(page: Page, name: string) {
  await page.locator('.region-map > summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name, exact: true }).click();
  const resume = page.getByRole('button', { name: `Continue ${name}`, exact: true });
  await (await resume.count() ? resume : page.locator('.region-travel-actions .btn-primary')).click();
}
async function seed(page: Page, session: SafariSession) {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('hoenn-seeded')) return;
    sessionStorage.setItem('hoenn-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, session);
}

test('start Hoenn, walk into Route 101 with its music, then resume both regions offline', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await open(page);
  const kanto = await saved(page);
  await switchRegion(page, 'Hoenn');
  await expect(page.getByRole('heading', { name: 'Hoenn', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Littleroot Town exploration map' })).toBeVisible();
  expect(await saved(page)).toMatchObject({ zoneId: 'littleroot-town', position: { x: 10, y: 12 }, catches: 0 });
  await expect(page.getByLabel('Music track')).toHaveValue('hoenn-littleroot-town');
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.screenshot({ path: info.outputPath('littleroot-desktop.png') });
  await page.locator('.region-map > summary').click();
  await page.screenshot({ path: info.outputPath('hoenn-region-map.png') });
  await page.locator('.region-map > summary').click();
  await page.getByRole('link', { name: '♫ Music', exact: true }).click();
  const audio = page.locator('audio');
  await audio.click({ position: { x: 20, y: 18 } });
  await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0)).toBe(true);
  const exit = regionPortals('littleroot-town').find(p => p.to === 'route-101')!;
  await page.locator('.safari-map').focus();
  for (const direction of [...routePath('littleroot-town', { x: 10, y: 12 }, { x: exit.x, y: 0 }), 'up']) {
    await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`); await page.waitForTimeout(125);
  }
  await expect(page.getByRole('group', { name: 'Route 101 exploration map' })).toBeVisible();
  await expect(page.getByLabel('Music track')).toHaveValue('hoenn-route-101');
  await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0)).toBe(true);
  const hoenn = await saved(page);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await switchRegion(page, 'Kanto');
  expect(await saved(page)).toMatchObject({ zoneId: kanto.zoneId, position: kanto.position, catches: 0 });
  await switchRegion(page, 'Hoenn');
  expect(await saved(page)).toMatchObject({ zoneId: 'route-101', position: hoenn.position, catches: 0 });
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect(await saved(page)).toMatchObject({ zoneId: 'route-101', position: hoenn.position, catches: 0 });
  expect(await page.locator('audio').evaluate(a => a.paused)).toBe(true);
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', zoneById('route-101').map[0].length * 16);
});

test('a Whismur SQL catch reaches PC, and the tunnel can encounter Whismur again', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { ...nearSafariGrass('rusturf-tunnel'), grassSteps: 5 });
  await open(page); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  const firstId = (await saved(page)).encounter!.id;
  await page.locator('.cm-content').fill("SELECT * FROM pokemon WHERE name = 'Whismur';");
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect.poll(async () => (await saved(page)).encounter!.attempts).toBe(1);
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.locator('.cm-content').fill("SELECT id, name, type1, type2 FROM pokedex WHERE name = 'Whismur';");
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures[0]).toMatchObject({ pokemon: { id: 293 }, location: 'Rusturf Tunnel', attempts: 2 });
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Rusturf Tunnel encounter table' })).toContainText('100.0%');
  await page.locator('.safari-map').focus();
  const patch = await page.locator('.safari-rustle').evaluate(e => ({ x: Number((e as HTMLElement).dataset.x), y: Number((e as HTMLElement).dataset.y) }));
  for (const direction of routePath('rusturf-tunnel', (await saved(page)).position, patch)) {
    if ((await saved(page)).encounter) break;
    await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`); await page.waitForTimeout(125);
  }
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  expect((await saved(page)).encounter).toMatchObject({ pokemonId: 293, outcome: 'active' });
  expect((await saved(page)).encounter!.id).not.toBe(firstId);
  expect((await collectionSnapshot(page)).captures).toHaveLength(1);
});

test('active Hoenn encounters disable region travel and preserve the current SQL task', async ({ page }) => {
  await seed(page, { ...nearSafariGrass('rusturf-tunnel'), encounter: { id: 'hoenn-active', pokemonId: 293, level: 10, assignmentId: 'field-notes', attempts: 2, outcome: 'active', fleeAfter: 8 }, draft: 'SELECT id, name FROM pokedex;' });
  await open(page);
  await page.locator('.region-map > summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: 'Kanto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Travel to Pallet Town', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect(await saved(page)).toMatchObject({ zoneId: 'rusturf-tunnel', draft: 'SELECT id, name FROM pokedex;', encounter: { id: 'hoenn-active', attempts: 2, outcome: 'active' } });
});

test.describe('Hoenn on iPad', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    test(`region selector, map and local art fit ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport); await open(page); await switchRegion(page, 'Hoenn');
      await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
      await page.locator('.region-map > summary').tap();
      const chart = page.getByRole('group', { name: 'Hoenn region map', exact: true });
      await expect(chart).toBeVisible();
      expect(await chart.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      const overlappingLabels = await chart.locator('.region-map-place span').evaluateAll(labels => {
        const boxes = labels.map(label => ({ name: label.textContent, box: label.getBoundingClientRect() }));
        return boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b =>
          a.box.left < b.box.right + 4 && b.box.left < a.box.right + 4
          && a.box.top < b.box.bottom && b.box.top < a.box.bottom).map(b => [a.name, b.name]));
      });
      expect(overlappingLabels).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.screenshot({ path: info.outputPath(`hoenn-ipad-${viewport.width}.png`) });
    });
  }
});
