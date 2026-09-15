import { test, expect, type Page } from '@playwright/test';

async function edit(page: Page, sql: string) {
  const editor = page.locator('.cm-content');
  await editor.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(sql);
}
async function run(page: Page, sql: string) {
  await edit(page, sql); await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('saves editor, database, named queries, and history without rerunning SQL on reload', async ({ page }) => {
  await run(page, "UPDATE pokemon SET name = 'Saved Bulbasaur' WHERE id = 1; SELECT name FROM pokemon WHERE id = 1;");
  await expect(page.getByRole('cell', { name: 'Saved Bulbasaur', exact: true })).toBeVisible();
  await page.getByLabel('Query name').fill('My first edit');
  await page.getByRole('button', { name: 'Save query', exact: true }).click();
  await edit(page, 'DROP TABLE pokemon;');
  await page.reload(); await expect(page.locator('.cm-content')).toContainText('DROP TABLE pokemon;');
  await run(page, 'SELECT name FROM pokemon WHERE id = 1;');
  await expect(page.getByRole('cell', { name: 'Saved Bulbasaur', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My first edit', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-query')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reset DB' }).click();
  await expect(page.getByText('Database restored and saved.', { exact: false })).toBeVisible();
  await page.reload(); await run(page, 'SELECT name FROM pokemon WHERE id = 1;');
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});

test('checks challenges against original data and remembers progress', async ({ page }) => {
  await run(page, 'DELETE FROM pokemon;');
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  await edit(page, "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');");
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await edit(page, 'SELECT name FROM pokemon LIMIT 1;');
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('Not quite yet.', { exact: false })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.getByRole('button', { name: /✓. First partners/ })).toBeVisible();
  await run(page, 'SELECT COUNT(*) AS remaining FROM pokemon;');
  await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible();
});

test('stops expensive SQL, restores last save, and enforces the time limit', async ({ page }) => {
  await run(page, "UPDATE pokemon SET name = 'Checkpoint' WHERE id = 1;");
  const expensive = 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;';
  await edit(page, expensive); await page.getByRole('button', { name: /▶ Run/ }).click();
  await page.getByRole('button', { name: '■ Stop query' }).click();
  await expect(page.getByRole('alert')).toContainText('Query stopped');
  await run(page, 'SELECT name FROM pokemon WHERE id = 1');
  await expect(page.getByRole('cell', { name: 'Checkpoint', exact: true })).toBeVisible();
  await edit(page, expensive); await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('alert')).toContainText('exceeded 8 seconds', { timeout: 15000 });
  await run(page, 'SELECT 42 AS answer;');
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
});

test('keeps explicit transactions and temporary tables usable across runs', async ({ page }) => {
  await run(page, "BEGIN; UPDATE pokemon SET name = 'Uncommitted' WHERE id = 1;");
  await expect(page.getByText('Transaction open.', { exact: false })).toBeVisible();
  await run(page, 'SELECT name FROM pokemon WHERE id = 1');
  await expect(page.getByRole('cell', { name: 'Uncommitted', exact: true })).toBeVisible();
  await run(page, 'COMMIT;'); await page.reload();
  await run(page, 'SELECT name FROM pokemon WHERE id = 1');
  await expect(page.getByRole('cell', { name: 'Uncommitted', exact: true })).toBeVisible();
  await run(page, 'CREATE TEMP TABLE team AS SELECT name FROM pokemon LIMIT 3;');
  await run(page, 'SELECT COUNT(*) FROM team;');
  await expect(page.getByRole('cell', { name: '3', exact: true })).toBeVisible();
});

test('works offline after caching, including sprites and reload', async ({ page, context }) => {
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true); await page.reload();
  await run(page, 'SELECT name, sprite_url FROM pokedex WHERE id = 6;');
  await expect(page.getByRole('cell', { name: 'Charizard', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('img.sprite').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 96)).toBe(true);
});

test('broken views and unusual identifiers do not break the schema browser', async ({ page }) => {
  await run(page, 'CREATE TABLE "team names" (name TEXT); DROP TABLE pokemon;');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.table-name', { hasText: 'team names' })).toBeVisible();
  await page.getByText('team names', { exact: true }).click();
  await page.getByRole('button', { name: '▶ SELECT * FROM team names', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'name', exact: true })).toBeVisible();
});

test('challenge layout fits desktop and narrow screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /Ghost race/ }).click();
  await edit(page, "SELECT name, speed FROM pokedex WHERE type1 = 'ghost' OR type2 = 'ghost' ORDER BY speed DESC, name ASC LIMIT 3;");
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
});
