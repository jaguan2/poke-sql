import { test, expect } from '@playwright/test';
import manifest from '../../src/features/safari/world-assets.json' with { type: 'json' };
import { createSafariSession } from '../../src/features/safari/model';
import { zoneById, type ZoneId } from '../../src/features/safari/zones';
import { regionPortals } from '../../src/features/safari/regions';

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });

for (const region of ['kanto', 'hoenn']) {
  test(`all ${region} outdoor maps draw their source layers and release old surfaces`, async ({ page }, info) => {
    test.setTimeout(60000);
    const entries = Object.entries(manifest.maps).filter(([, entry]) => entry.region === region);
    await page.addInitScript(session => {
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
      sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
    }, createSafariSession(entries[0][0] as ZoneId));
    await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const samples = [];
    for (const [index, [id, entry]] of entries.entries()) {
      if (index) {
        await page.locator('.region-map > summary').click();
        await page.getByLabel('Area', { exact: true }).selectOption(id);
        await page.getByRole('button', { name: `Travel to ${zoneById(id as ZoneId).name}`, exact: true }).click();
      }
      await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.safari-world-foreground')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.safari-route-world canvas')).toHaveCount(2);
      const sample = await page.evaluate(async () => {
        const ground = document.querySelector<HTMLCanvasElement>('.safari-world-ground')!;
        const front = document.querySelector<HTMLCanvasElement>('.safari-world-foreground')!;
        const original = document.querySelector<HTMLImageElement>('.safari-terrain')!;
        await original.decode();
        const canvas = document.createElement('canvas'); canvas.width = ground.width; canvas.height = ground.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(ground, 0, 0); context.drawImage(front, 0, 0);
        const actual = context.getImageData(0, 0, canvas.width, canvas.height).data;
        context.drawImage(original, 0, 0);
        const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
        return { equal: actual.every((n, index) => n === expected[index]), width: ground.width,
          height: ground.height, canvasBytes: ground.width * ground.height * 8 };
      });
      expect(sample.equal, id).toBe(true);
      expect([sample.width, sample.height], id).toEqual([entry.width * 16, entry.height * 16]);
      expect(sample.canvasBytes).toBeLessThan(8 * 1024 * 1024);
      samples.push({ id, ...sample });
      if (['viridian-forest', 'route-4', 'petalburg-woods', 'route-104', 'mauville-city'].includes(id)) {
        await page.locator('.safari-map').screenshot({ path: info.outputPath(`${id}.png`), animations: 'disabled' });
      }
    }
    await info.attach('native-canvas-allocation-estimates', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  });
}

test('a pending neighbor is shared across travel and background loading stays local', async ({ page }) => {
  const exit = regionPortals('pallet-town').find(portal => portal.y === -1)!;
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...createSafariSession('pallet-town'), position: { x: exit.x, y: 0 },
  });
  let unblock!: () => void;
  const gate = new Promise<void>(resolve => { unblock = resolve; });
  let neighborRequests = 0;
  const maps = new Set<string>();
  page.on('request', request => {
    if (request.url().endsWith('.tmj')) maps.add(request.url().split('/').at(-1)!);
  });
  await page.route('**/safari/worlds/kanto/route-1.tmj', async route => {
    neighborRequests++; await gate; await route.continue();
  });
  try {
    await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => neighborRequests).toBe(1);
    expect([...maps].sort()).toEqual(['pallet-town.tmj', 'route-1.tmj']);
    await page.getByRole('group', { name: 'Pallet Town exploration map' }).focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('group', { name: 'Route 1 exploration map' })).toBeVisible();
    unblock();
    await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
    expect(neighborRequests).toBe(1);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
    await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
    expect(neighborRequests).toBe(1);
  } finally { unblock(); }
});

test('a failed neighbor preload is retried when entering that area', async ({ page }) => {
  const exit = regionPortals('pallet-town').find(portal => portal.y === -1)!;
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...createSafariSession('pallet-town'), position: { x: exit.x, y: 0 },
  });
  let attempts = 0;
  await page.route('**/safari/worlds/kanto/route-1.tmj', async route => {
    attempts++; if (attempts === 1) await route.abort(); else await route.continue();
  });
  const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('route-1.tmj'));
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await failed;
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('group', { name: 'Pallet Town exploration map' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('group', { name: 'Route 1 exploration map' })).toBeVisible();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  expect(attempts).toBe(2);
});
