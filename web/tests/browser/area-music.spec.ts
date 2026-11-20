import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import { regionPortals } from '../../src/features/safari/regions';
import { isWalkable, zoneById, type ZoneId } from '../../src/features/safari/zones';
import { routePath } from '../fixtures/safari';

async function seed(page: Page, zoneId: ZoneId = 'pallet-town', position = zoneById(zoneId).start) {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('area-music-seeded')) return;
    sessionStorage.setItem('area-music-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, { ...createSafariSession(zoneId), position, visited: [...new Set(['pallet-town', 'viridian-city', zoneId])] });
}
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
}
async function play(page: Page) {
  const audio = page.getByLabel('Music playback');
  await audio.click({ position: { x: 20, y: 18 } });
  await expect.poll(() => audio.evaluate((player: HTMLAudioElement) => !player.paused && player.currentTime > 0)).toBe(true);
}
async function travel(page: Page, name: string) {
  await page.locator('.region-map > summary').click();
  await page.getByRole('button', { name: `View ${name}`, exact: true }).click();
  await page.getByRole('button', { name: `Travel to ${name}`, exact: true }).click();
}

test('walking changes the area theme while playback, pause, mute, manual tracks and reload keep their meaning', async ({ page }) => {
  await seed(page);
  await open(page);
  const audio = page.getByLabel('Music playback');
  const track = page.getByLabel('Music track');
  await expect(track).toHaveValue('kanto-pallet-town');
  expect(await audio.evaluate((a: HTMLAudioElement) => ({ paused: a.paused, loop: a.loop }))).toEqual({ paused: true, loop: true });
  await page.getByRole('link', { name: '♫ Music', exact: true }).click();
  await play(page);
  await audio.evaluate((a: HTMLAudioElement) => { a.volume = .12; a.muted = true; });
  await page.locator('.safari-map').focus();
  for (const direction of [...routePath('pallet-town', { x: 6, y: 8 }, { x: 12, y: 0 }), 'up']) {
    await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`);
    await page.waitForTimeout(125);
  }
  await expect(track).toHaveValue('kanto-route-1');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0)).toBe(true);
  expect(await audio.evaluate((a: HTMLAudioElement) => [a.volume, a.muted])).toEqual([.12, true]);
  await audio.evaluate((a: HTMLAudioElement) => a.pause());
  await travel(page, 'Viridian City');
  await expect(track).toHaveValue('kanto-pewter-city');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.getByLabel('Follow area music').uncheck();
  await expect(track).toHaveValue('kanto-pallet-town');
  await track.selectOption('kanto-route-1');
  await play(page);
  await page.getByLabel('Follow area music').check();
  await expect(track).toHaveValue('kanto-pewter-city');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused)).toBe(true);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await expect(track).toHaveValue('kanto-route-1');
  await page.reload();
  await expect(track).toHaveValue('kanto-route-1');
  expect(await audio.evaluate((a: HTMLAudioElement) => [a.paused, a.volume, a.muted])).toEqual([true, .12, true]);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(track).toHaveValue('kanto-pewter-city');
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
});

test('playlist advancement preserves area following until the trainer explicitly chooses a track', async ({ page }) => {
  await page.goto('/');
  await play(page);
  await page.getByLabel('Music playback').evaluate((a: HTMLAudioElement) => { a.currentTime = a.duration - .1; });
  await expect(page.getByLabel('Music track')).toHaveValue('kanto-route-1');
  await expect(page.getByLabel('Follow area music')).toBeChecked();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByLabel('Music track')).toHaveValue('kanto-pallet-town');
  await expect.poll(() => page.getByLabel('Music playback').evaluate((a: HTMLAudioElement) => !a.paused)).toBe(true);
});

for (const [from, to, theme, stays] of [
  ['forest-south-gate', 'viridian-forest', 'kanto-viridian-forest', false],
  ['mt-moon-b1f', 'mt-moon-1f', 'kanto-mt-moon', true],
] as const) {
  test(`${from} → ${to} plays the right local theme offline${stays ? ' without restarting it' : ''}`, async ({ page, context }) => {
    const portal = regionPortals(from).find(portal => portal.to === to)!;
    const approach = [
      { x: portal.x, y: portal.y + 1, key: 'ArrowUp' }, { x: portal.x, y: portal.y - 1, key: 'ArrowDown' },
      { x: portal.x + 1, y: portal.y, key: 'ArrowLeft' }, { x: portal.x - 1, y: portal.y, key: 'ArrowRight' },
    ].find(p => isWalkable(zoneById(from), p))!;
    await seed(page, from, { x: approach.x, y: approach.y });
    await open(page);
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await context.setOffline(true);
    const audio = page.getByLabel('Music playback');
    await play(page);
    await audio.evaluate((a: HTMLAudioElement) => { a.currentTime = 30; });
    await page.locator('.safari-map').focus();
    await page.keyboard.press(approach.key);
    await expect(page.getByRole('group', { name: `${zoneById(to).name} exploration map` })).toBeVisible();
    await expect(page.getByLabel('Music track')).toHaveValue(theme);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => ({ playing: !a.paused, time: a.currentTime > 0, error: a.error?.message }))).toEqual({ playing: true, time: true, error: undefined });
    if (stays) expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(30);
    const response = await page.evaluate(async () => {
      const r = await fetch('music/kanto/viridian-forest.mp3', { headers: { Range: 'bytes=0-63' } });
      return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
    });
    expect(response).toEqual({ status: 206, bytes: 64 });
  });
}

test.describe('iPad area music', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    test(`music controls fit ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await seed(page, 'viridian-forest');
      await open(page);
      await page.getByRole('link', { name: '♫ Music', exact: true }).tap();
      const radio = page.getByRole('region', { name: 'Music player' });
      await expect(page.getByLabel('Music track')).toHaveValue('kanto-viridian-forest');
      await expect(page.getByLabel('Follow area music')).toBeVisible();
      expect(await radio.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.screenshot({ path: info.outputPath(`area-music-${viewport.width}.png`) });
    });
  }
});
