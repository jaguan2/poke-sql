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

test('the schema picker shows a selected table and previews its rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  const tables = page.getByRole('group', { name: 'Tables and views', exact: true });
  await expect(tables.getByRole('button', { name: 'pokedex view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'SQL guide', exact: true })).toBeInViewport();
  const types = tables.getByRole('button', { name: 'types table', exact: true });
  await types.focus();
  await page.keyboard.press('Enter');
  await expect(types).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: 'types columns', exact: true }).locator('.col-name')).toHaveText(['id 🔑', 'name']);
  await page.getByRole('button', { name: '▶ SELECT * FROM types', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'name', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(18);
  await expect(page.getByRole('cell', { name: 'fire', exact: true })).toBeVisible();
});

test('the guide shortcut reaches reference topics on a portrait tablet', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await page.getByRole('link', { name: 'SQL guide ↓', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SQL guide', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('heading', { name: 'SQL guide', exact: true })).toBeFocused();
  const filters = topic(page, 'WHERE filters');
  await filters.locator('summary').click();
  await filters.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText("type1 = 'water'");
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('the guide sits below the schema and loads a runnable example without executing it', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
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
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Challenge schema', exact: true })).toBeVisible();
  const filters = topic(page, 'WHERE filters');
  await filters.locator('summary').click();
  await filters.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current challenge', exact: true })).toContainText('First partners');
  await expect(page.locator('.cm-content')).toContainText("type1 = 'water'");
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText(`Training · 0/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS practice_draft;');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await filters.locator('summary').click();
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

test('the reference page cannot replace SQL while a query is running', async ({ page }) => {
  await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: 'Schema & guide', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Schema & guide', exact: true })).toBeEnabled();
  await expect(page.locator('.cm-content')).toContainText('CROSS JOIN');
});

test('the mobile guide wraps examples and returns to the editor without nested scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  const windows = topic(page, 'Window functions');
  await windows.locator('summary').click();
  await windows.locator('pre').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await windows.locator('pre').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator('.sidebar, .body').evaluateAll(elements => elements.some(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1))).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('sql-guide-mobile.png') });
  await windows.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('ROW_NUMBER() OVER');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await windows.locator('summary').click();
  await expect(windows.locator('pre')).toBeVisible();
});
