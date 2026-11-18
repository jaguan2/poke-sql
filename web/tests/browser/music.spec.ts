import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import tracks from '../../src/features/music/tracks.json' with { type: 'json' };
import byteRange from '../../desktop/byte-range.cjs';

async function openWorkspace(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
}

async function play(page: Page) {
  // Native media controls have browser-owned shadow DOM. Exercise their play
  // button with a real gesture, then observe actual decoding and progression.
  const audio = page.locator('audio');
  await audio.click({ position: { x: 20, y: 18 } });
  await expect.poll(() => audio.evaluate(player => !player.paused && player.currentTime > 0)).toBe(true);
}

test('music stays independent of SQL and restores preferences without autoplay', async ({ page }) => {
  await openWorkspace(page);
  const audio = page.locator('audio');
  expect(await audio.evaluate(player => player.paused && player.preload === 'none')).toBe(true);
  await page.getByLabel('Music track').selectOption('canalave');
  await play(page);
  await audio.evaluate(player => { player.volume = 0.12; });
  await page.getByLabel('Repeat track').check();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:music')!).volume)).toBe(0.12);

  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('SELECT 42 AS answer;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset DB' }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  expect(await audio.evaluate(player => !player.paused && player.loop)).toBe(true);
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  expect(await audio.evaluate(player => !player.paused)).toBe(true);

  await page.reload();
  await expect(page.getByLabel('Music track')).toHaveValue('canalave');
  await expect(page.getByLabel('Repeat track')).toBeChecked();
  expect(await audio.evaluate(player => ({ paused: player.paused, volume: player.volume, muted: player.muted })))
    .toEqual({ paused: true, volume: 0.12, muted: false });
  await play(page);
  await page.getByLabel('Music track').selectOption('photosynthesis');
  expect(await audio.evaluate(player => player.paused)).toBe(true);
});

test('all bundled tracks play offline, seek, and advance through the playlist', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4175/')) external.push(request.url()); });
  await openWorkspace(page);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await openWorkspace(page);
  const audio = page.locator('audio');
  for (const track of tracks) {
    await page.getByLabel('Music track').selectOption(track.id);
    await play(page);
    expect(await audio.evaluate(player => Number.isFinite(player.duration) && player.duration > 60)).toBe(true);
    await audio.evaluate(player => { player.currentTime = 30; });
    await expect.poll(() => audio.evaluate(player => player.currentTime)).toBeGreaterThanOrEqual(30);
    await audio.evaluate(player => player.pause());
  }
  // The last track should advance to the first, then continue to the second.
  for (const next of ['photosynthesis', 'canalave']) {
    await play(page);
    await audio.evaluate(player => { player.currentTime = player.duration - 0.1; });
    await expect(page.getByLabel('Music track')).toHaveValue(next);
    await expect.poll(() => audio.evaluate(player => !player.paused && player.currentTime > 0)).toBe(true);
    await audio.evaluate(player => player.pause());
  }
  expect(external).toEqual([]);
});

test('cached audio answers byte ranges with the exact original bytes', async ({ page, context }) => {
  await openWorkspace(page);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await openWorkspace(page);
  const file = tracks[0].file;
  const original = readFileSync(`public/music/${file}`);
  for (const [range, expected, status, contentRange] of [
    ['bytes=0-63', Array.from(original.subarray(0, 64)), 206, `bytes 0-63/${original.length}`],
    ['bytes=-64', Array.from(original.subarray(-64)), 206, `bytes ${original.length - 64}-${original.length - 1}/${original.length}`],
    [`bytes=${original.length}-`, [], 416, `bytes */${original.length}`],
  ] as const) {
    const response = await page.evaluate(async ({ file, range }) => {
      const response = await fetch(`music/${file}`, { headers: { Range: range } });
      return { status: response.status, type: response.headers.get('Content-Type'), range: response.headers.get('Content-Range'), bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
    }, { file, range });
    expect(response).toEqual({ status, type: 'audio/mpeg', range: contentRange, bytes: expected });
  }
});

test('invalid settings, blocked storage, and missing music remain recoverable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokesql:music', JSON.stringify({ trackId: 'missing', volume: 99, muted: 'yes', repeat: null }));
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await openWorkspace(page);
  await expect(page.getByLabel('Music track')).toHaveValue('photosynthesis');
  expect(await page.locator('audio').evaluate(player => player.volume)).toBe(0.25);
  await page.getByLabel('Repeat track').check();
  await expect(page.getByText('Music settings apply for this session;', { exact: false })).toBeVisible();
  // A missing file causes a genuine media load error, without mocking Audio.
  await page.locator('audio').evaluate(player => { player.src = '/missing-track.mp3'; player.load(); });
  await expect(page.getByText('This track could not play.', { exact: false })).toBeVisible();
  await page.getByLabel('Music track').selectOption('canalave');
  await play(page);
  await expect(page.getByText('This track could not play.', { exact: false })).toHaveCount(0);
});

test('music controls and credits fit desktop and narrow layouts', async ({ page }, testInfo) => {
  await openWorkspace(page);
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const radio = page.getByRole('region', { name: 'Poké Radio' });
    await radio.scrollIntoViewIfNeeded();
    await radio.getByText('Music credits & use', { exact: true }).click();
    await expect(radio.getByText('Original Pokémon Diamond music:', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(await radio.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`music-${viewport.width}.png`), fullPage: true });
    await radio.getByText('Music credits & use', { exact: true }).click();
  }
});

test('byte range parser handles open, suffix, clamped, and invalid ranges', () => {
  expect(byteRange.parseByteRange('bytes=2-4', 10)).toEqual({ start: 2, end: 4 });
  expect(byteRange.parseByteRange('bytes=2-', 10)).toEqual({ start: 2, end: 9 });
  expect(byteRange.parseByteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
  expect(byteRange.parseByteRange('bytes=-30', 10)).toEqual({ start: 0, end: 9 });
  expect(byteRange.parseByteRange('bytes=0-99', 10)).toEqual({ start: 0, end: 9 });
  for (const range of ['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'bytes=9007199254740992-', 'garbage']) {
    expect(byteRange.parseByteRange(range, 10)).toBeNull();
  }
  expect(byteRange.parseByteRange('bytes=0-', 0)).toBeNull();
});
