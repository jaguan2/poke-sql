import { test, expect, type Page } from '@playwright/test';
import { CHALLENGES } from '../../src/features/practice/challenges';

async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
}

function topic(page: Page, name: string) {
  const guide = page.getByRole('region', { name: 'SQL guide', exact: true });
  return guide.locator('details').filter({ has: page.getByText(name, { exact: true }) });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('the guide sits below the schema and loads a runnable example without executing it', async ({ page }, testInfo) => {
  const guide = page.getByRole('region', { name: 'SQL guide', exact: true });
  await guide.scrollIntoViewIfNeeded();
  expect((await guide.boundingBox())!.y).toBeGreaterThan((await page.getByRole('heading', { name: 'Schema', exact: true }).boundingBox())!.y);
  await guide.getByText('Query structure', { exact: true }).click();
  await expect(guide.locator('.sql-clause-order pre')).toContainText('GROUP BY columns');
  const joins = topic(page, 'JOIN tables');
  await joins.locator('summary').click();
  await expect(joins).toContainText('one row per type');
  await joins.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('JOIN pokemon_types AS pt');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('.history-query')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('sql-guide-desktop.png') });
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tbody tr').first()).toContainText('Bulbasaur');
});

test('loading guide examples preserves the current challenge or mystery and their separate drafts', async ({ page }) => {
  await edit(page, 'SELECT 42 AS practice_draft;');
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  const filters = topic(page, 'WHERE filters');
  await filters.locator('summary').click();
  await filters.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current challenge', exact: true })).toContainText('First partners');
  await expect(page.getByRole('heading', { name: 'Challenge schema', exact: true })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText("type1 = 'water'");
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText(`Training · 0/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS practice_draft;');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await filters.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await expect(page.getByText('Research query only', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  await expect(page.locator('.cm-content')).toContainText("type1 = 'water'");
});

test('guide examples cannot replace SQL while a query is running', async ({ page }) => {
  const basics = topic(page, 'SELECT & FROM');
  await basics.locator('summary').click();
  await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(basics.getByRole('button', { name: 'Load example', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(basics.getByRole('button', { name: 'Load example', exact: true })).toBeEnabled();
  await expect(page.locator('.cm-content')).toContainText('CROSS JOIN');
});

test('the mobile guide wraps examples and returns to the editor without nested scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const tools = page.getByRole('button', { name: 'Tools & schema' });
  await tools.click();
  const windows = topic(page, 'Window functions');
  await windows.locator('summary').click();
  await windows.locator('pre').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await windows.locator('pre').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator('.sidebar, .body').evaluateAll(elements => elements.some(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1))).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('sql-guide-mobile.png') });
  await windows.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(tools).toHaveAttribute('aria-expanded', 'false');
  await expect(tools).toBeFocused();
  await expect(page.locator('.cm-content')).toContainText('ROW_NUMBER() OVER');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await tools.click();
  await expect(windows.locator('pre')).toBeVisible();
});
