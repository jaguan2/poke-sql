import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { nearSafariGrass } from '../fixtures/safari';

test('Windows Bag prevents encounters and preserves supplies, steps and Shiny Charm after restart', async ({}, info) => {
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE, args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow(); await page.locator('.cm-content').waitFor();
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), { ...nearSafariGrass(), catches: 10, grassSteps: 5 });
    await page.reload(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
    let bag = page.locator('.bag-page'); await bag.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(bag.locator('.bag-effects')).toContainText('100 steps left');
    await bag.getByRole('button', { name: 'Key Items', exact: true }).click(); await bag.getByRole('button', { name: 'Activate', exact: true }).click();
    await expect(bag.locator('.bag-effects')).toContainText('Active · 1 in 64');
    await bag.getByRole('button', { name: 'Close Bag' }).click(); await page.keyboard.press('a');
    await expect(page.locator('.safari-item-bar')).toContainText('99 steps left');
    await expect(page.locator('.safari-map')).toBeVisible(); await expect(page.locator('.safari-guide-note')).toContainText('1 in 64');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).bag);
    expect(before).toEqual({ used: { repel: 1, 'super-repel': 0, 'max-repel': 0 }, repelSteps: 99, charmEnabled: true });
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click(); bag = page.locator('.bag-page');
    await expect(bag.locator('.bag-effects')).toContainText('99 steps left'); await expect(bag.locator('.bag-effects')).toContainText('Active · 1 in 64');
    await expect(bag.getByRole('button', { name: 'Repel × 4', exact: true })).toBeVisible();
    await expect.poll(() => bag.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).bag); expect(after).toEqual(before);
    // Hidden native windows do not guarantee compositor frames. Browser gallery covers pixels.
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()))
      .toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true });
    await writeFile(info.outputPath('bag-state.json'), JSON.stringify({ version: await app.evaluate(({ app }) => app.getVersion()), before, after }, null, 2));
  } finally { await app?.close(); }
});
