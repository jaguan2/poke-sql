import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

test('desktop loads bundled SQL and sprites without Node access in the page', async () => {
  const data = await mkdtemp(path.resolve('test-results/desktop-'));
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env,
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined');
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
    await page.locator('.cm-content').click(); await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('SELECT name, sprite_url FROM pokedex WHERE id = 25;');
    await page.getByRole('button', { name: /▶ Run/ }).click();
    await expect(page.getByRole('cell', { name: 'Pikachu', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('img.sprite').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 96)).toBe(true);
    // Hidden packaged windows may not produce compositor frames for screenshots.
    // Browser layout tests capture the shared frontend; this checks the shell.
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()))
      .toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true });
  } finally {
    await app.close();
    const relative = path.relative(path.resolve('test-results'), path.resolve(data));
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
  }
});
