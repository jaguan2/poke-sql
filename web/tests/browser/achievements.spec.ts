import { test, expect, type Page } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';

const genOneIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 37, 38];

async function openAchievements(page: Page) {
  await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await page.getByRole('button', { name: /^Achievements/ }).click();
}

async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
}

test('generation and type achievements show exact unique progress across the whole collection', async ({ page }) => {
  const entries = await entriesFor(genOneIds);
  entries.find(entry => entry.pokemon.id === 6)!.sources = ['daily', 'random'];
  await page.addInitScript(entries => localStorage.setItem('pokesql:encounters', JSON.stringify(entries)), entries);
  await page.goto('/');
  await openAchievements(page);
  const genOne = page.getByRole('article', { name: 'Gen 1 · Kanto', exact: true });
  await expect(genOne.locator('.achievement-count')).toHaveText('12 / 151 collected');
  await expect(genOne.getByRole('progressbar')).toHaveAttribute('max', '151');
  await expect(genOne.locator('li').filter({ hasText: 'collect 10: earned' })).toHaveAttribute('data-earned', 'true');
  await expect(page.getByRole('region', { name: 'Generation achievements', exact: true }).getByRole('article')).toHaveCount(9);
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  const fire = page.getByRole('article', { name: 'Fire collector', exact: true });
  await expect(fire.locator('.achievement-count')).toHaveText('5 / 81 collected');
  await expect(page.getByRole('article', { name: 'Flying collector', exact: true }).getByRole('progressbar')).toHaveAttribute('value', '1');
  await expect(page.getByRole('region', { name: 'Type achievements', exact: true }).getByRole('article')).toHaveCount(18);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByLabel('Search discovered Pokémon', { exact: true }).fill('#0006');
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  await expect(fire.locator('.achievement-count')).toHaveText('5 / 81 collected');
});

test('solving a mystery unlocks a type milestone that survives offline reload', async ({ page, context }) => {
  const entries = await entriesFor([4, 5, 6, 37]);
  await page.addInitScript(entries => {
    if (sessionStorage.getItem('achievement-seed')) return;
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 38, guessCount: 0, attempts: [] }));
    sessionStorage.setItem('achievement-seed', 'yes');
  }, entries);
  await page.goto('/');
  await openAchievements(page);
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  const fire = page.getByRole('article', { name: 'Fire collector', exact: true });
  await expect(fire.locator('li').filter({ hasText: 'collect 5: locked' })).toHaveAttribute('data-earned', 'false');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await edit(page, 'SELECT id FROM pokedex WHERE id = 38;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  await expect(fire.locator('li').filter({ hasText: 'collect 5: earned' })).toHaveAttribute('data-earned', 'true');
  await expect(fire.getByRole('progressbar')).toHaveAttribute('value', '5');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await openAchievements(page);
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  await expect(fire.locator('.achievement-count')).toHaveText('5 / 81 collected');
  await expect(fire.locator('li').filter({ hasText: 'collect 5: earned' })).toHaveAttribute('data-earned', 'true');
});

test('practice database edits and resets cannot change original achievement goals or saved progress', async ({ page }) => {
  const entries = await entriesFor(genOneIds);
  await page.addInitScript(entries => {
    if (sessionStorage.getItem('achievement-seed')) return;
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    sessionStorage.setItem('achievement-seed', 'yes');
  }, entries);
  await page.goto('/');
  await edit(page, 'DROP TABLE pokemon; DROP TABLE types;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.locator('.status-bar')).toContainText('Statement executed');
  await page.reload();
  await openAchievements(page);
  await expect(page.getByRole('article', { name: 'Gen 1 · Kanto', exact: true }).locator('.achievement-count')).toHaveText('12 / 151 collected');
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Fire collector', exact: true }).getByRole('progressbar')).toHaveAttribute('max', '81');
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Reset DB', exact: true }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  await openAchievements(page);
  await expect(page.getByRole('article', { name: 'Gen 1 · Kanto', exact: true }).getByRole('progressbar')).toHaveAttribute('value', '12');
});

test('achievement progress and milestone badges fit desktop and mobile without nested mobile scroll', async ({ page }, testInfo) => {
  const entries = await entriesFor(genOneIds);
  await page.addInitScript(entries => localStorage.setItem('pokesql:encounters', JSON.stringify(entries)), entries);
  await page.goto('/');
  await openAchievements(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width === 390) {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('radio', { name: 'Ultra Ball', exact: true }).check();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Generations', exact: true }).click();
    const genOne = page.getByRole('article', { name: 'Gen 1 · Kanto', exact: true });
    await genOne.scrollIntoViewIfNeeded();
    await expect(genOne).toBeInViewport();
    if (width === 1440) {
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: testInfo.outputPath(`generations-${width}.png`) });
    await page.getByRole('button', { name: 'Types', exact: true }).click();
    const fire = page.getByRole('article', { name: 'Fire collector', exact: true });
    await fire.scrollIntoViewIfNeeded();
    await expect(fire).toBeInViewport();
    expect(await fire.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width <= 620) {
      expect(await page.locator('.app, .body, .main, .pokedex-achievements, .achievement-grid').evaluateAll(elements => elements.some(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1))).toBe(false);
      await expect(page.getByRole('button', { name: 'Back to workspace', exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: testInfo.outputPath(`types-${width}.png`) });
  }
});
