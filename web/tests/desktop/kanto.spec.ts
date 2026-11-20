import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSafariSession } from '../../src/features/safari/model';
import { regionPortals } from '../../src/features/safari/regions';

test('desktop Kanto crosses a native route exit and restores the region after restart', async ({}, info) => {
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
    await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 384);
    const exit = regionPortals('route-1').find(portal => portal.to === 'viridian-city')!;
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('route-1'), position: { x: exit.x, y: 0 },
    });
    await page.reload();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('group', { name: 'Viridian City exploration map' })).toBeVisible();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
    expect(before.visited).toEqual(['pallet-town', 'route-1', 'viridian-city']);
    expect(before.catches).toBe(0);
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Viridian City exploration map' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!))).toEqual(before);
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await writeFile(info.outputPath('desktop-kanto-state.json'), JSON.stringify(before, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
