import { test, expect, type Page } from '@playwright/test';

async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
}

async function run(page: Page, sql: string) {
  await edit(page, sql);
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('storage failures do not claim a durable save or break the editor', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
    IDBFactory.prototype.open = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await edit(page, 'SELECT 42;');
  await expect(page.getByText('This device could not save your SQL or progress.', { exact: false })).toBeVisible();
  await page.getByLabel('Query name').fill('Session only');
  await page.getByRole('button', { name: 'Save query', exact: true }).click();
  await expect(page.getByText('Query kept for this session only.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Reset DB' }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  await expect(page.getByText('Could not save the database on this device.', { exact: false })).toBeVisible();
  await run(page, 'SELECT 42 AS answer;');
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
});

test('arbitrary SQL values in type columns stay plain text without crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await run(page, "SELECT 'constructor' AS type UNION ALL SELECT 'toString' UNION ALL SELECT '__proto__' UNION ALL SELECT 'hasOwnProperty' UNION ALL SELECT NULL UNION ALL SELECT x'1234' UNION ALL SELECT 42 UNION ALL SELECT 'electric';");
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await expect(page.getByRole('cell', { name: 'constructor', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'toString', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '__proto__', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'NULL', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '<blob>', exact: true })).toBeVisible();
  await expect(page.locator('.type-badge')).toHaveCount(1);
  await expect(page.locator('.type-badge')).toHaveCSS('color', 'rgb(0, 0, 0)');
  expect(errors).toEqual([]);
});

test('all fetched rows are accessible and a new result starts at the first page', async ({ page }) => {
  await run(page, 'SELECT id, name FROM pokemon ORDER BY id;');
  await expect(page.locator('tbody tr')).toHaveCount(500);
  await expect(page.getByRole('button', { name: 'Previous rows' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next rows' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Oshawott');
  await page.getByRole('button', { name: 'Next rows' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await expect(page.getByRole('button', { name: 'Next rows' })).toBeDisabled();
  await run(page, 'SELECT name FROM pokemon WHERE id = 1;');
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});

test('challenge schema survives sandbox changes and a grade clears when the answer changes', async ({ page }) => {
  await run(page, 'DROP TABLE pokemon;');
  await expect(page.locator('.table-name').filter({ hasText: /^pokemon$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  await expect(page.locator('.table-name').filter({ hasText: /^pokemon$/ })).toHaveCount(1);
  await edit(page, "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');");
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await edit(page, 'SELECT 1;');
  await expect(page.getByText('✓ Correct! Challenge completed.')).toHaveCount(0);
  await expect(page.getByText('Answer changed.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Back to free practice' }).click();
  await expect(page.locator('.table-name').filter({ hasText: /^pokemon$/ })).toHaveCount(0);
});

test('challenge controls and footer stay reachable on short desktop screens', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 480 });
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /Ghost race/ }).click();
  await page.locator('.workspace-status').scrollIntoViewIfNeeded();
  await expect(page.locator('.workspace-status')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(900);
});
