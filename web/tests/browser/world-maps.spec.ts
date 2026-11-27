import { test, expect } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import { regionPortals } from '../../src/features/safari/regions';

for (const viewport of [{ width: 1440, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`layered Pallet Town preserves source pixels and walking at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(session => {
      if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
    }, createSafariSession('pallet-town'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const ground = page.locator('.safari-world-ground'), front = page.locator('.safari-world-foreground');
    await expect(ground).toHaveAttribute('data-ready', 'true');
    await expect(front).toHaveAttribute('data-ready', 'true');
    const pixels = await page.evaluate(async () => {
      const ground = document.querySelector<HTMLCanvasElement>('.safari-world-ground')!;
      const front = document.querySelector<HTMLCanvasElement>('.safari-world-foreground')!;
      const image = document.querySelector<HTMLImageElement>('.safari-terrain')!;
      await image.decode();
      const combined = document.createElement('canvas'), original = document.createElement('canvas');
      combined.width = original.width = ground.width; combined.height = original.height = ground.height;
      const a = combined.getContext('2d')!, b = original.getContext('2d')!;
      a.drawImage(ground, 0, 0); a.drawImage(front, 0, 0); b.drawImage(image, 0, 0);
      const actual = a.getImageData(0, 0, ground.width, ground.height).data;
      const expected = b.getImageData(0, 0, ground.width, ground.height).data;
      const foreground = front.getContext('2d')!.getImageData(0, 0, front.width, front.height).data;
      return { equal: actual.every((value, index) => value === expected[index]), foreground: foreground.some((value, index) => index % 4 === 3 && value > 0),
        frontDepth: Number(getComputedStyle(front).zIndex), playerDepth: Number(getComputedStyle(document.querySelector('.safari-player')!).zIndex) };
    });
    expect(pixels.equal).toBe(true); expect(pixels.foreground).toBe(true); expect(pixels.frontDepth).toBeGreaterThan(pixels.playerDepth);
    const map = page.getByRole('group', { name: 'Pallet Town exploration map' });
    await map.focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await map.screenshot({ path: info.outputPath('pallet-town-layers.png'), animations: 'disabled' });
    await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(front).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
  });
}

test('walking the native boundary replaces canvases and retains the original portal arrival', async ({ page }) => {
  const exit = regionPortals('pallet-town').find(portal => portal.y === -1)!;
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...createSafariSession('pallet-town'), position: { x: exit.x, y: 0 },
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('group', { name: 'Pallet Town exploration map' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('group', { name: 'Route 1 exploration map' })).toBeVisible();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', String(exit.arrival.x));
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', String(exit.arrival.y));
  expect(await page.locator('.safari-world-ground').evaluate((canvas: HTMLCanvasElement) => canvas.height)).toBe(640);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  expect(await page.locator('.safari-world-ground').evaluate((canvas: HTMLCanvasElement) => canvas.height)).toBe(320);
});

test('a failed tilemap keeps flat art visible and keyboard walking usable', async ({ page }) => {
  await page.route('**/safari/worlds/**', route => route.abort());
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), createSafariSession('pallet-town'));
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 384);
  await page.getByRole('group', { name: 'Pallet Town exploration map' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
});

test('layered maps and atlases survive an offline production reload', async ({ page, context }) => {
  await page.addInitScript(session => {
    if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, createSafariSession('viridian-city'));
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.safari-world-foreground')).toHaveAttribute('data-ready', 'true');
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.safari-world-ground')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.safari-world-foreground')).toHaveAttribute('data-ready', 'true');
});
