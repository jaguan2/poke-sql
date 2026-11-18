import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { nearSafariGrass } from '../fixtures/safari';

test('desktop Safari fleeing persists its limit and outcome without registering a catch', async ({}, info) => {
  const data = info.outputPath('profile');
  await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    app = await electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
      args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), nearSafariGrass());
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Chances before fleeing', { exact: true }).selectOption('5');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await page.keyboard.press('a');
    await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Catch chances remaining' })).toHaveAttribute('value', '5');
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.locator('.cm-content').focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText('SELECT 1;');
      await page.getByRole('button', { name: /Check query & catch/ }).click();
      if (attempt < 5) await expect(page.getByRole('progressbar', { name: 'Catch chances remaining' })).toHaveAttribute('value', String(5 - attempt));
    }
    await expect(page.locator('.safari-fled-summary')).toContainText('After 5 incorrect answers');
    await expect(page.locator('.safari-pass strong')).toHaveText('00');
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Chances before fleeing', { exact: true })).toHaveValue('5');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await expect(page.locator('.safari-fled-summary')).toContainText('After 5 incorrect answers');
    await expect(page.getByRole('button', { name: /Check query & catch/ })).toHaveCount(0);
    await page.getByText('Review a solution', { exact: true }).click();
    await expect(page.locator('.safari-fled-summary pre').last()).toContainText('FROM pokedex');
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Verdant Forest collection progress' })).toHaveAttribute('value', '0');
    await page.getByRole('button', { name: /^My Pokédex/ }).click();
    await expect(page.getByRole('heading', { name: 'Your first discovery is waiting' })).toBeVisible();
  } finally {
    try { await app?.close(); }
    finally {
      const relative = path.relative(path.resolve(info.outputDir), path.resolve(data));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
    }
  }
});
