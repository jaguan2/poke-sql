import { test, expect, type Page } from '@playwright/test';
import { CHALLENGES } from '../src/challenges';

async function loadDirectAnswer(page: Page) {
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('specific Get started prompts reveal help without executing and return the promised Pokémon', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('-- Top 10 Pokémon by HP');
  await page.getByText('Hint', { exact: true }).click();
  await expect(page.locator('.query-help pre:visible')).toHaveText('ORDER BY hp DESC, id\nLIMIT 10');
  await expect(page.locator('.cm-line')).toHaveText(['-- Top 10 Pokémon by HP', 'SELECT ']);
  await loadDirectAnswer(page);
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tbody tr').first().locator('td')).toHaveText(['Blissey', '255', 'normal', 'NULL']);
  await expect(page.locator('tbody tr').nth(1)).toContainText('Chansey');

  await page.getByRole('button', { name: 'All Pokémon from Gen 1', exact: true }).click();
  await loadDirectAnswer(page);
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(151);
  await expect(page.locator('tbody tr').first()).toContainText('Bulbasaur');
  await expect(page.locator('tbody tr').last()).toContainText('Mew');

  await page.getByRole('button', { name: 'All Fire-type Pokémon from Gen 2', exact: true }).click();
  await loadDirectAnswer(page);
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tbody tr').first()).toContainText('Cyndaquil');
  await expect(page.locator('tbody tr').last().locator('td')).toHaveText(['Ho-Oh', 'fire', 'flying', '680']);
});

test('sample drafts stay separate and hint and answer disclosures reset for a new prompt', async ({ page }) => {
  await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
  await loadDirectAnswer(page);
  await page.getByRole('button', { name: 'All Pokémon from Gen 1', exact: true }).click();
  await expect(page.locator('.cm-content')).not.toContainText('ORDER BY hp');
  await expect(page.getByRole('article', { name: 'Direct approach' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('ORDER BY hp DESC, id');
  await expect(page.getByRole('article', { name: 'Direct approach' })).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('ORDER BY hp DESC, id');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to free practice' }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM pokedex LIMIT 15;');
});

test('challenge alternative answers are revealable, load without grading, and pass when checked', async ({ page }) => {
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  await page.getByText('Hint', { exact: true }).click();
  await expect(page.locator('.query-help pre:visible')).toContainText("WHERE name IN ('Bulbasaur'");
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Using OR conditions' }).getByRole('button', { name: 'Use this answer' }).click();
  await expect(page.locator('.cm-content')).toContainText("OR name = 'Charmander'");
  await expect(page.getByText(`Training · 0/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toHaveCount(0);
  await expect(page.getByText('Answer loaded. Check it when you are ready.')).toBeVisible();
});

test('worked answers and their controls stay usable on desktop and mobile', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
  await page.getByText('Answer', { exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    const alternate = page.getByRole('article', { name: 'Using a window function' }).getByRole('button', { name: 'Use this answer' });
    await alternate.scrollIntoViewIfNeeded();
    await expect(alternate).toBeInViewport();
    await alternate.click();
    await expect(page.locator('.cm-content')).toContainText('ROW_NUMBER() OVER');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`worked-answer-${width}.png`), fullPage: true });
  }
});

test('Charizard lookup loads without running and shows its sprite on desktop and mobile', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: "Charizard's Pokédex card", exact: true }).click();
  await page.getByText('Hint', { exact: true }).click();
  await expect(page.locator('.query-help pre:visible')).toHaveText("WHERE name = 'Charizard'");
  await loadDirectAnswer(page);
  await expect(page.locator('.cm-content')).toContainText("WHERE name = 'Charizard'");
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('cell', { name: 'Charizard', exact: true })).toBeVisible();
  await expect(page.locator('.type-badge')).toHaveText(['fire', 'flying']);
  await expect.poll(() => page.locator('img.sprite').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 96)).toBe(true);
  await page.getByText('Hint', { exact: true }).click();
  await page.getByText('Answer', { exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('region', { name: 'Query results', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator('img.sprite')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`charizard-card-${width}.png`) });
  }
});

test('new popular Pokémon challenges grade correctly and retain existing completion', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pokesql:completed', JSON.stringify(['fast-ghosts'])));
  await page.reload();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.getByRole('button', { name: /✓\. Ghost race/ })).toBeVisible();
  await page.getByRole('button', { name: /Meet Charizard/ }).click();
  await loadDirectAnswer(page);
  await expect(page.getByText(`Training · 1/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.getByRole('button', { name: /Charizard's type weaknesses/ }).click();
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText("SELECT 'rock', 2 UNION ALL SELECT 'electric', 2 UNION ALL SELECT 'water', 2;");
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('Not quite yet.', { exact: false })).toBeVisible();
  await expect(page.getByText(`Training · 2/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Naming each defense with a CTE' }).getByRole('button', { name: 'Use this answer' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await expect(page.locator('tbody tr').first().locator('td')).toHaveText(['rock', '4']);
  await expect(page.getByText(`Training · 3/${CHALLENGES.length} complete`, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  for (const name of [/✓\. Ghost race/, /✓\. Meet Charizard/, /✓\. Charizard's type weaknesses/]) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
});
