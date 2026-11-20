import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSafariSession } from '../../src/features/safari/model';

test('desktop area themes decode, seek, follow town travel and restore paused after a native restart', async ({}, info) => {
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('viridian-forest'), visited: ['pallet-town', 'viridian-forest', 'pewter-city'],
    });
    await page.reload();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const track = page.getByLabel('Music track');
    const audio = page.locator('audio');
    await expect(track).toHaveValue('kanto-viridian-forest');
    expect(await audio.evaluate(a => a.paused)).toBe(true);
    await audio.click({ position: { x: 20, y: 18 } });
    await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0)).toBe(true);
    await audio.evaluate(a => { a.currentTime = 30; a.volume = .1; });
    await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(30.2);
    await page.locator('.region-map > summary').click();
    await page.getByRole('button', { name: 'View Pewter City', exact: true }).click();
    await page.getByRole('button', { name: 'Travel to Pewter City', exact: true }).click();
    await expect(track).toHaveValue('kanto-pewter-city');
    await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0)).toBe(true);
    const range = await page.evaluate(async () => {
      const r = await fetch('music/kanto/viridian-forest.mp3', { headers: { Range: 'bytes=0-63' } });
      return { status: r.status, type: r.headers.get('Content-Type'), bytes: (await r.arrayBuffer()).byteLength };
    });
    expect(range).toEqual({ status: 206, type: 'audio/mpeg', bytes: 64 });
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByLabel('Music track')).toHaveValue('kanto-pewter-city');
    const state = await page.locator('audio').evaluate(a => ({ paused: a.paused, volume: a.volume, crossOrigin: a.crossOrigin }));
    expect(state).toEqual({ paused: true, volume: .1, crossOrigin: 'anonymous' });
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await writeFile(info.outputPath('area-music-state.json'), JSON.stringify({ state, range }, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
