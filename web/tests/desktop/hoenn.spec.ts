import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSafariSession } from '../../src/features/safari/model';
import { regionPortals } from '../../src/features/safari/regions';

async function switchRegion(page: Page, name: string) {
  await page.locator('.region-map > summary').click();
  await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name, exact: true }).click();
  const resume = page.getByRole('button', { name: `Continue ${name}`, exact: true });
  await (await resume.count() ? resume : page.locator('.region-travel-actions .btn-primary')).click();
}

test('desktop Hoenn restores regional positions and plays bundled area music after restart', async ({}, info) => {
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
    await switchRegion(page, 'Hoenn');
    await expect(page.getByRole('group', { name: 'Littleroot Town exploration map' })).toBeVisible();
    const exit = regionPortals('littleroot-town').find(portal => portal.to === 'route-101')!;
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('littleroot-town'), position: { x: exit.x, y: 0 },
    });
    await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('group', { name: 'Route 101 exploration map' })).toBeVisible();
    await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 320);
    await expect(page.getByLabel('Music track')).toHaveValue('hoenn-route-101');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
    await switchRegion(page, 'Kanto'); await switchRegion(page, 'Hoenn');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!))).toMatchObject({
      zoneId: 'route-101', position: saved.position, catches: 0,
    });
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Route 101 exploration map' })).toBeVisible();
    await expect(page.getByLabel('Music track')).toHaveValue('hoenn-route-101');
    await page.getByRole('link', { name: '♫ Music', exact: true }).click();
    const audio = page.locator('audio');
    expect(await audio.evaluate(a => a.paused)).toBe(true);
    await audio.click({ position: { x: 20, y: 18 } });
    await expect.poll(() => audio.evaluate(a => !a.paused && a.currentTime > 0 && !a.error)).toBe(true);
    expect(await audio.evaluate(a => a.currentSrc)).toContain('pokesql://app/music/hoenn/route-101.mp3');
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await page.screenshot({ path: info.outputPath('desktop-hoenn.png') });
    await writeFile(info.outputPath('desktop-hoenn-state.json'), JSON.stringify(saved, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
