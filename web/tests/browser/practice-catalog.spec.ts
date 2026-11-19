import { test, expect } from '@playwright/test';

test('Get started is a browsable page with topic filters and separate question drafts', async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await page.locator('.cm-content').fill('SELECT 42 AS my_draft;');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeFocused();
  await expect(page.locator('.catalog-question')).toHaveCount(25);
  await expect(page.locator('.cm-content')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Workspace menu' }).getByRole('button')).toHaveCount(9);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('get-started-desktop.png') });
  await page.getByRole('button', { name: /Connect tables/ }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(6);
  await page.getByLabel('Find a question').fill('Charizard');
  await expect(page.locator('.catalog-question')).toHaveCount(2);
  await page.getByRole('button', { name: "Charizard's abilities", exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText("-- Charizard's abilities");
  await page.locator('.cm-content').fill('SELECT ability FROM pokedex;');
  await page.getByRole('button', { name: 'All questions', exact: true }).click();
  await expect(page.getByLabel('Find a question')).toHaveValue('Charizard');
  await expect(page.locator('.catalog-question')).toHaveCount(2);
  await page.getByLabel('Progress', { exact: true }).selectOption('draft');
  await expect(page.locator('.catalog-question')).toHaveCount(1);
  await page.getByRole('button', { name: "Charizard's abilities", exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT ability FROM pokedex;');
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS my_draft;');
});

test('challenge cards show real completion and recover from empty filters offline', async ({ page, context }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(15);
  await page.getByRole('button', { name: 'First partners', exact: true }).click();
  await page.locator('.cm-content').fill("SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur','Charmander','Squirtle');");
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.getByRole('button', { name: 'All challenges', exact: true }).click();
  await page.getByLabel('Progress', { exact: true }).selectOption('completed');
  await expect(page.locator('.catalog-question')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '✓. First partners', exact: true })).toBeVisible();
  await page.getByLabel('Find a question').fill('NoSuchPokemon');
  await expect(page.getByRole('heading', { name: 'No matching questions' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all questions', exact: true }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(15);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.getByRole('button', { name: '✓. First partners', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('challenges-desktop.png') });
});

test('catalogs, collapsed navigation and library pages fit a narrow screen', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: 'Hide menu', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.getByRole('heading', { name: 'Get started', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByLabel('Find a question').fill('Top 10');
  await expect(page.locator('.catalog-question')).toHaveCount(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('get-started-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Show menu', exact: true }).click();
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Schema & guide', exact: true })).toBeFocused();
  await expect(page.locator('.table-name').filter({ hasText: /^pokedex$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('browsing section pages preserves the current query and results', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cm-content').fill("SELECT name FROM pokemon WHERE id = 1;");
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
  for (const name of ['Get started', 'Challenges', 'Schema & guide', 'History', 'Saved']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText('SELECT name FROM pokemon WHERE id = 1;');
    await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: 'Free practice', exact: true }).last().click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});
