import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('desktop Johto drops into an unvisited cave, plays local music and restores the area after restart', async ({}, info) => {
  test.setTimeout(75000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('.region-map > summary').click();
    await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: 'Johto', exact: true }).click();
    await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption('union-cave-1f');
    await page.getByRole('button', { name: 'Travel to Union Cave 1F', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Union Cave 1F exploration map' })).toBeVisible();
    await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 320);
    await expect(page.getByLabel('Music track')).toHaveValue('johto-union-cave');
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.getByRole('link', { name: '♫ Music', exact: true }).click();
    const audio = page.locator('audio');
    await audio.click({ position: { x: 20, y: 18 } });
    await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0 && !a.error)).toBe(true);
    expect(await audio.evaluate(a => a.currentSrc)).toContain('pokesql://app/music/johto/union-cave.mp3');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
    expect(before).toMatchObject({ zoneId: 'union-cave-1f', catches: 0, encounter: null });
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Union Cave 1F exploration map' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!))).toEqual(before);
    expect(await page.locator('audio').evaluate(a => a.paused)).toBe(true);
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await page.screenshot({ path: info.outputPath('desktop-johto.png') });
    await writeFile(info.outputPath('desktop-johto-state.json'), JSON.stringify(before, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
