import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('desktop loads bundled SQL and sprites without Node access in the page', async ({}, testInfo) => {
  const data = testInfo.outputPath('profile');
  await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({
    executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env,
  });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch();
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
    // A second process must exit instead of opening another database snapshot
    // against the same persisted profile.
    await promisify(execFile)(await app.evaluate(() => process.execPath),
      process.env.POKESQL_EXECUTABLE ? [] : ['.'],
      { env, windowsHide: true, timeout: 10000 });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    const responses = await page.evaluate(async () => {
      const urls = ['/index.html', '/%2e%2e%2fpackage.json', '/%2e%2e%5cpackage.json', '/%zz'];
      return Promise.all(urls.map(async url => {
        const response = await fetch(url);
        return { status: response.status, csp: response.headers.get('Content-Security-Policy') };
      }));
    });
    expect(responses.map(response => response.status)).toEqual([200, 404, 404, 400]);
    expect(responses[0].csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    await page.locator('.cm-content').click(); await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('CREATE TABLE desktop_saved (value TEXT); INSERT INTO desktop_saved VALUES (\'Persisted\');');
    await page.getByRole('button', { name: /Run/ }).click();
    await expect(page.getByRole('button', { name: /Run/ })).toBeEnabled();
    await expect(page.getByRole('complementary').getByText('desktop_saved', { exact: true })).toBeVisible();
    await app.close();
    app = undefined;
    app = await launch();
    const reopened = await app.firstWindow();
    await expect(reopened.getByRole('button', { name: /Run/ })).toBeEnabled();
    await reopened.locator('.cm-content').click(); await reopened.keyboard.press('ControlOrMeta+A');
    await reopened.keyboard.insertText('SELECT value FROM desktop_saved;');
    await reopened.getByRole('button', { name: /Run/ }).click();
    await expect(reopened.getByRole('cell', { name: 'Persisted', exact: true })).toBeVisible();
  } finally {
    try {
      await app?.close();
    } finally {
      const relative = path.relative(path.resolve(testInfo.outputDir), path.resolve(data));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
    }
  }
});
