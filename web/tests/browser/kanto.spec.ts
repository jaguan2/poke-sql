import { test, expect, type Page } from '@playwright/test';
import { createSafariSession, visitedLocations } from '../../src/features/safari/model';
import { safariAssignment } from '../../src/features/safari/assignments';
import { isWalkable, movePosition, zoneById, type Direction } from '../../src/features/safari/zones';
import type { SafariSession } from '../../src/features/safari/types';
import { routePath } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';
import { regionPortals } from '../../src/features/safari/regions';

async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kanto', exact: true })).toBeVisible();
}
async function step(page: Page, direction: Direction) {
  await page.keyboard.press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]);
  await page.waitForTimeout(125);
}
async function saved(page: Page): Promise<SafariSession> { return page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!)); }
async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
}

test('a new trainer walks from Pallet Town into Route 1 and resumes there offline', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await open(page);
  await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Pallet Town guide' })).toContainText('No Pokémon encounters here.');
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.screenshot({ path: info.outputPath('kanto-pallet-town-desktop.png') });
  await page.locator('.region-map > summary').click();
  await page.getByRole('button', { name: 'View Viridian City', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Travel to Viridian City', exact: true })).toBeEnabled();
  await page.keyboard.press('d');
  expect((await saved(page)).position).toEqual({ x: 6, y: 8 });
  await page.screenshot({ path: info.outputPath('kanto-region-map-desktop.png') });
  await page.locator('.region-map > summary').click();
  await page.locator('.safari-map').focus();
  for (const direction of routePath('pallet-town', { x: 6, y: 8 }, { x: 12, y: 0 })) await step(page, direction);
  expect((await saved(page)).encounter).toBeNull();
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await step(page, 'up');
  await expect(page.getByRole('group', { name: 'Route 1 exploration map' })).toBeVisible();
  expect(await saved(page)).toMatchObject({ zoneId: 'route-1', position: { x: 12, y: 39 }, visited: ['pallet-town', 'route-1'], catches: 0 });
  const before = await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 384);
  await expect(page.locator('.safari-battle-scene')).toHaveCount(0);
});

test('Route 1 SQL encounters consume wrong attempts and commit the correct catch to PC with its route', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const zone = zoneById('route-1');
  const patch = zone.rustle;
  const approach = (['up', 'down', 'left', 'right'] as const).map(direction => ({ direction, position: movePosition(zone, patch, direction) })).find(p => isWalkable(zone, p.position) && p.position !== patch)!;
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
  const session = { ...createSafariSession('route-1'), position: approach.position, grassSteps: 5 };
  await page.addInitScript(session => {
    if (sessionStorage.getItem('kanto-seeded')) return;
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    localStorage.setItem('pokesql:safari-flee-after', '8');
    sessionStorage.setItem('kanto-seeded', 'yes');
  }, session);
  await open(page);
  await step(page, reverse[approach.direction]);
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  const active = await saved(page);
  expect([16, 19]).toContain(active.encounter!.pokemonId);
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await edit(page, 'SELECT * FROM pokemon;');
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect.poll(async () => (await saved(page)).encounter!.attempts).toBe(1);
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect((await saved(page)).encounter).toMatchObject({ id: active.encounter!.id, attempts: 1, outcome: 'active' });
  const species = zone.species.find(s => s.id === active.encounter!.pokemonId)!;
  await edit(page, safariAssignment(active.encounter!.assignmentId, species).sql);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  const collection = await collectionSnapshot(page);
  expect(collection.captures).toHaveLength(1);
  expect(collection.captures[0]).toMatchObject({ id: `safari:${active.encounter!.id}`, pokemon: { id: species.id }, location: 'Route 1', attempts: 2 });
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  expect(await saved(page)).toMatchObject({ zoneId: 'route-1', position: active.position, catches: 1 });
});

test('walking into Viridian City records the visit and keeps the visited map after reload', async ({ page }) => {
  const exit = regionPortals('route-1').find(portal => portal.to === 'viridian-city')!;
  await page.addInitScript(session => {
    if (sessionStorage.getItem('kanto-seeded')) return;
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    sessionStorage.setItem('kanto-seeded', 'yes');
  }, { ...createSafariSession('route-1'), position: { x: exit.x, y: 0 } });
  await open(page);
  await step(page, 'up');
  await expect(page.getByRole('group', { name: 'Viridian City exploration map' })).toBeVisible();
  expect(visitedLocations(await saved(page))).toEqual(['pallet-town', 'route-1', 'viridian-city']);
  await page.locator('.region-map > summary').click();
  await page.getByRole('button', { name: 'View Pallet Town', exact: true }).click();
  await page.getByRole('button', { name: 'Travel to Pallet Town', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
  await page.locator('.region-map > summary').click();
  await page.getByRole('button', { name: 'View Viridian City', exact: true }).click();
  await page.getByRole('button', { name: 'Travel to Viridian City', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Viridian City exploration map' })).toBeVisible();
  const before = await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect(await saved(page)).toEqual(before);
});

test.describe('touch exploration', () => {
test.use({ isMobile: true, hasTouch: true });
for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`Kanto fits an iPad at ${viewport.width}×${viewport.height} and towns open PC without losing the journey`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await open(page);
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.locator('.region-map > summary').click();
    await expect(page.getByRole('button', { name: 'View Cerulean City', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path: info.outputPath(`kanto-ipad-${viewport.width}.png`) });
    await page.locator('.region-map > summary').click();
    const before = await saved(page);
    await page.getByRole('button', { name: 'Open PC Boxes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'PC Boxes', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    expect(await saved(page)).toEqual(before);
    expect(visitedLocations(await saved(page))).toEqual(['pallet-town']);
  });
}
});
