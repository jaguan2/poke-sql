import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('desktop footer edits SQL, runs it and restores the draft without replay', async ({}, info) => {
  test.setTimeout(60000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    const run = page.getByRole('button', { name: /Run query/ });
    await expect(run).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save query', exact: true })).toHaveCount(0);
    const original = await page.locator('.cm-content').innerText();
    const sql = 'SELECT name FROM pokemon WHERE id = 1;';
    await page.locator('.cm-content').fill(sql);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText(original, { useInnerText: true });
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText(sql);
    await page.locator('.editor-actions').getByRole('button', { name: /Run query/ }).click();
    await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
    await page.locator('.cm-content').fill('DROP TABLE pokemon;');
    await app.close(); app = await launch(); page = await app.firstWindow();
    await expect(page.locator('.cm-content')).toHaveText('DROP TABLE pokemon;');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.locator('.cm-content').fill(sql);
    await page.getByRole('button', { name: /Run query/ }).click();
    await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({ require: typeof Reflect.get(globalThis, 'require'),
      process: typeof Reflect.get(globalThis, 'process') }))).toEqual({ require: 'undefined', process: 'undefined' });
  } finally { await app?.close(); }
});
