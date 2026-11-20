import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('desktop replaces a retired remix with a local game track and keeps listening preferences', async ({}, info) => {
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Run query/ }).waitFor();
    const previous = { trackId: 'canalave', volume: 0.37, muted: true, repeat: true, followArea: false };
    await page.addInitScript(previous => {
      if (sessionStorage.getItem('music-migration-seeded')) return;
      sessionStorage.setItem('music-migration-seeded', 'yes');
      localStorage.setItem('pokesql:music', JSON.stringify(previous));
    }, previous);
    await page.reload();
    await expect(page.getByLabel('Music track')).toHaveValue('kanto-pallet-town');
    await expect(page.getByLabel('Music track').locator('option')).toHaveCount(26);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:music')!)))
      .toEqual({ ...previous, trackId: 'kanto-pallet-town' });
    const audio = page.locator('audio');
    const restored = await audio.evaluate(a => ({ paused: a.paused, volume: a.volume, muted: a.muted, loop: a.loop }));
    expect(restored).toEqual({ paused: true, volume: 0.37, muted: true, loop: true });
    await audio.click({ position: { x: 20, y: 18 } });
    await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0 && !a.error)).toBe(true);
    expect(await audio.evaluate(a => a.currentSrc)).toContain('pokesql://app/music/kanto/pallet-town.mp3');
    await writeFile(info.outputPath('music-migration.json'), JSON.stringify({ restored, selected: 'kanto-pallet-town' }, null, 2));
  } finally { await app.close().catch(() => {}); }
});
