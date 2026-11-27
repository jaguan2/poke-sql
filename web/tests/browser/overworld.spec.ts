import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import type { ZoneId } from '../../src/features/safari/zones';
import { openSafariQuery } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';

async function seed(page: Page, id: ZoneId, x: number, y: number, direction = 'right') {
  await page.addInitScript(session => {
    if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, { ...createSafariSession(id), position: { x: Math.round(x), y: Math.round(y) }, direction,
    exploration: { enabled: true, mapId: id, x, y, direction, mode: 'walking', autoSurf: false } });
}
const position = (page: Page) => page.locator('.smooth-overworld').evaluate(node => ({ x: Number((node as HTMLElement).dataset.x), y: Number((node as HTMLElement).dataset.y) }));
async function open(page: Page) {
  await page.goto('/?debug=overworld'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.smooth-overworld')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.smooth-overworld')).toHaveAttribute('data-x', /\d/);
}

for (const viewport of [{ width: 1440, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`smooth walking, running, pause and save recovery work at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await seed(page, 'pallet-town', 6, 8); await open(page);
    const map = page.locator('.smooth-overworld'); await map.focus();
    const before = await position(page);
    await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d'); await page.waitForTimeout(140);
    const walked = await position(page); expect(walked.x - before.x).toBeGreaterThan(1);
    await page.keyboard.down('Shift'); await page.keyboard.down('d'); await page.waitForTimeout(500);
    await page.keyboard.up('d'); await page.keyboard.up('Shift'); await page.waitForTimeout(140);
    const ran = await position(page); expect(ran.x - walked.x).toBeGreaterThan(walked.x - before.x);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume exploration', exact: true })).toBeVisible();
    const stopped = await position(page); await page.keyboard.down('s'); await page.waitForTimeout(200); await page.keyboard.up('s');
    expect(await position(page)).toEqual(stopped);
    await page.getByRole('button', { name: 'Resume exploration', exact: true }).click();
    await page.locator('.overworld-viewport').screenshot({ path: info.outputPath('smooth-pallet-town.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(map).toHaveAttribute('data-ready', 'true');
    await expect.poll(async () => Math.abs((await position(page)).x - stopped.x)).toBeLessThan(.05);
    await page.getByLabel('Exploration movement', { exact: true }).selectOption('classic');
    await expect(page.locator('.safari-map')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).exploration.enabled)).toBe(false);
  });
}

test('land map crossing keeps world camera continuity and fractional player position', async ({ page }) => {
  await seed(page, 'pallet-town', 12, 0, 'up'); await open(page);
  const map = page.locator('.smooth-overworld'); const before = Number(await map.getAttribute('data-camera-y'));
  await map.focus(); await page.keyboard.down('w'); await page.waitForTimeout(420); await page.keyboard.up('w');
  await expect(map).toHaveAttribute('data-map', 'route-1');
  expect(Math.abs(Number(await map.getAttribute('data-camera-y')) - before)).toBeLessThan(3);
  expect((await position(page)).y).toBeGreaterThan(38);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).zoneId)).toBe('route-1');
});

test('pointer movement releases cleanly and focused settings do not move the player', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 }); await seed(page, 'pallet-town', 6, 8); await open(page);
  const start = await position(page), button = page.getByRole('button', { name: 'Walk right', exact: true });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForTimeout(450); await page.mouse.up(); await page.waitForTimeout(150);
  expect((await position(page)).x).toBeGreaterThan(start.x + 1);
  await page.getByRole('checkbox', { name: 'Run', exact: true }).focus();
  const stopped = await position(page);
  await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
  expect(await position(page)).toEqual(stopped);
  await page.getByRole('checkbox', { name: 'Automatic Surf', exact: true }).check();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).exploration.autoSurf)).toBe(true);
});

test('restoring a position whose feet straddle a loaded map seam keeps its fractional coordinate', async ({ page }) => {
  await seed(page, 'route-1', 12, 39.4, 'up'); await open(page);
  expect((await position(page)).y).toBeCloseTo(39.4, 2);
});

test('Surf mounts at a real shoreline, saves on water and restores offline', async ({ page, context }, info) => {
  await seed(page, 'route-103', 21, 9); await open(page);
  const map = page.locator('.smooth-overworld'); await map.focus();
  await page.keyboard.press('f'); await expect(map).toHaveAttribute('data-mode', 'surfing');
  await expect(page.getByRole('heading', { name: 'Water encounters', exact: true })).toBeVisible();
  await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d'); await page.waitForTimeout(160);
  const afloat = await position(page); expect(afloat.x).toBeGreaterThan(23);
  await page.locator('.overworld-viewport').screenshot({ path: info.outputPath('surf-route-103.png') });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 30000 });
  await context.setOffline(true); await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(map).toHaveAttribute('data-mode', 'surfing');
  expect(Math.abs((await position(page)).x - afloat.x)).toBeLessThan(.05);
});

test('choosing a visible Pokémon reuses SQL catching and retains its PC reward offline', async ({ page, context }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(page, 'route-1', 15, 8); await open(page);
  await page.locator('.overworld-debug > summary').click();
  const entities = page.getByRole('list', { name: 'Wild Pokémon debug', exact: true }).locator('li');
  await expect(entities).toHaveCount(3);
  for (let i = 0; i < 8 && !await page.getByRole('button', { name: /^Interact with/ }).count(); i++) {
    const current = await position(page), target = await entities.first().evaluate(node => ({ x: Number((node as HTMLElement).dataset.x), y: Number((node as HTMLElement).dataset.y) }));
    const key = Math.abs(target.x - current.x) > Math.abs(target.y - current.y) ? target.x > current.x ? 'd' : 'a' : target.y > current.y ? 's' : 'w';
    await page.locator('.smooth-overworld').focus(); await page.keyboard.down(key); await page.waitForTimeout(160); await page.keyboard.up(key); await page.waitForTimeout(160);
  }
  await expect(page.getByRole('button', { name: /^Interact with/ }).first()).toBeVisible();
  await page.locator('.overworld-viewport').screenshot({ path: info.outputPath('visible-pokemon.png') });
  await page.getByRole('button', { name: /^Interact with/ }).first().click(); await openSafariQuery(page);
  const parked = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).exploration);
  await expect(page.locator('.safari-chances')).toContainText('Unlimited attempts');
  const target = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId as number);
  await page.locator('.cm-content').fill('SELECT * FROM pokedex WHERE id = -1;');
  await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  await expect(page.locator('.safari-query-actions')).toContainText('1 checked query');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).exploration)).toEqual(parked);
  await page.locator('.cm-content').fill(`SELECT * FROM pokedex WHERE id IN (SELECT id FROM pokemon WHERE id=${target});`);
  await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures).toMatchObject([{ pokemon: { id: target } }]);
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.locator('.smooth-overworld')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 30000 });
  await context.setOffline(true); await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.smooth-overworld')).toHaveAttribute('data-ready', 'true');
  expect((await collectionSnapshot(page)).captures).toHaveLength(1);
});
