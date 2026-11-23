import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSafariSession } from '../../src/features/safari/model';

test('Windows held walking crosses an area exit without a pause and stops before restart', async ({}, info) => {
  test.setTimeout(60000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    await page.locator('.cm-content').waitFor();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('pallet-town'), position: { x: 12, y: 1 },
    });
    await page.reload();
    await page.clock.install({ time: new Date('2026-11-20T12:00:00Z') }); await page.clock.pauseAt('2026-11-20T12:00:01Z');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.keyboard.down('w'); await page.clock.runFor(280); await page.keyboard.up('w');
    await expect(page.getByRole('group', { name: 'Route 1 exploration map', exact: true })).toBeVisible();
    await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '38');
    await page.clock.runFor(500); await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '38');
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '38');
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await writeFile(info.outputPath('movement-state.json'), await page.evaluate(() => localStorage.getItem('pokesql:safari')!));
  } finally { await app?.close().catch(() => {}); }
});
