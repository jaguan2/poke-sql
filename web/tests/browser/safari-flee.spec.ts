import { test, expect, type Page } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

async function seed(page: Page) {
  await page.addInitScript(session => {
    Math.random = () => 0;
    if (sessionStorage.getItem('flee-seeded')) return;
    sessionStorage.setItem('flee-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, nearSafariGrass());
}
async function limit(page: Page, value: 'unlimited' | '5' | '8') {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Chances before fleeing', { exact: true }).selectOption(value);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}
async function encounter(page: Page) {
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
}
async function submit(page: Page, sql = 'SELECT 1;') {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
}
const correct = 'SELECT id, name, type1, type2 FROM pokedex WHERE id=10;';

test('five chances warn before fleeing, persist through offline reload and allow a fresh encounter', async ({ page, context }, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1600 });
  await seed(page); await page.goto('/'); await limit(page, '5');
  await page.reload();
  await encounter(page);
  const level = await page.locator('.encounter-nameplate small').textContent();
  const chances = page.getByRole('progressbar', { name: 'Catch chances remaining' });
  await expect(chances).toHaveAttribute('value', '5');
  await page.getByText('Need a hint?', { exact: true }).click();
  await expect(chances).toHaveAttribute('value', '5');
  // Changing the next encounter's rule must not refill this encounter.
  await limit(page, '8');
  await expect(chances).toHaveAttribute('max', '5');
  for (const remaining of [4, 3, 2]) {
    await submit(page);
    await expect(chances).toHaveAttribute('value', String(remaining));
  }
  await expect(page.locator('.encounter-caption')).toHaveText('Caterpie seems wary…');
  await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(chances).toHaveAttribute('value', '2');
  await expect(chances).toHaveAttribute('max', '5');
  await submit(page);
  await expect(chances).toHaveAttribute('value', '1');
  await expect(page.locator('.encounter-caption')).toHaveText('Caterpie looks ready to flee!');
  await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath('last-chance.png'), animations: 'disabled' });
  await submit(page);
  await expect(page.locator('.encounter-caption')).toHaveText('Oh no! Caterpie fled!');
  await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
  await expect(page.getByRole('heading', { name: 'Caterpie slipped away.' })).toBeVisible();
  await expect(page.locator('.safari-fled-summary')).toContainText('Return exactly 4 columns');
  await expect(page.locator('.safari-pass strong')).toHaveText('00');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toHaveCount(0);
  await page.getByText('Review a solution', { exact: true }).click();
  await expect(page.locator('.safari-fled-summary pre').last()).toContainText('WHERE id = 10');
  await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath('fled-scene.png'), animations: 'disabled' });
  await page.locator('.safari-fled-summary').screenshot({ path: info.outputPath('fled-and-review.png'), animations: 'disabled' });
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Caterpie slipped away.' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter)).toMatchObject({ outcome: 'fled', attempts: 5, fleeAfter: 5 });
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Verdant Forest collection progress' })).toHaveAttribute('value', '0');
  const caterpie = page.getByRole('row', { name: 'Unknown common Pokémon', exact: true }).filter({ has: page.locator('img[src$="/10.png"]') });
  await expect(caterpie.getByRole('cell')).toHaveText(/\d+\.\d%/);
  await page.keyboard.press('d'); await page.waitForTimeout(130); await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await expect(chances).toHaveAttribute('value', '8');
  await expect(page.locator('.encounter-caption')).toHaveText('A wild Caterpie appeared!');
  await submit(page, correct);
  await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
});

test('SQL errors, stopped queries and timeouts are free, and the fifth checked answer can catch', async ({ page }) => {
  test.setTimeout(45000);
  await seed(page); await page.goto('/'); await limit(page, '5'); await encounter(page);
  const chances = page.getByRole('progressbar', { name: 'Catch chances remaining' });
  await submit(page, 'SELEC name FROM pokemon;');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(chances).toHaveAttribute('value', '5');
  await submit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await expect(page.getByRole('alert')).toContainText('Query exceeded 8 seconds', { timeout: 15000 });
  await expect(chances).toHaveAttribute('value', '5');
  await submit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Query stopped');
  await expect(chances).toHaveAttribute('value', '5');
  for (const remaining of [4, 3, 2, 1]) {
    await submit(page); await expect(chances).toHaveAttribute('value', String(remaining));
  }
  await submit(page, correct);
  await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
  await expect(page.locator('.safari-catch-summary')).toContainText('Completed in 5 queries.');
  await expect(page.locator('.safari-pass strong')).toHaveText('01');
});

test('eight chances last through seven wrong answers and flee on the eighth', async ({ page }) => {
  await seed(page); await page.goto('/'); await limit(page, '8'); await encounter(page);
  for (let remaining = 7; remaining >= 1; remaining--) {
    await submit(page);
    await expect(page.getByRole('progressbar', { name: 'Catch chances remaining' })).toHaveAttribute('value', String(remaining));
  }
  await submit(page);
  await expect(page.locator('.safari-fled-summary')).toContainText('After 8 incorrect answers');
  await expect(page.locator('.safari-pass strong')).toHaveText('00');
});

test('relaxed practice is the default and keeps the Pokémon after nine wrong answers', async ({ page }) => {
  await seed(page); await page.goto('/'); await encounter(page);
  await expect(page.locator('.safari-chances')).toContainText('Unlimited attempts');
  for (let attempt = 1; attempt <= 9; attempt++) {
    await submit(page);
    await expect(page.locator('.safari-query-actions')).toContainText(`${attempt} checked ${attempt === 1 ? 'query' : 'queries'}`);
  }
  await submit(page, correct);
  await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
});

test('invalid preferences fall back to relaxed practice and a blocked setting write is explained', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pokesql:safari-flee-after', JSON.stringify(3)));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Chances before fleeing', { exact: true })).toHaveValue('unlimited');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByLabel('Chances before fleeing', { exact: true }).selectOption('8');
  await expect(page.getByText('This device could not save a profile change.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Chances before fleeing', { exact: true })).toHaveValue('8');
});

test('the fled solution review fits a small phone and returns to a usable route', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...nearSafariGrass(), encounter: { id: 'phone', pokemonId: 10, assignmentId: 'ability-survey', attempts: 4, fleeAfter: 5, outcome: 'active' },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await submit(page);
  await page.getByText('Review a solution', { exact: true }).click();
  await expect(page.locator('.safari-fled-summary pre').last()).toContainText('JOIN pokemon_abilities');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('fled-mobile.png'), animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.locator('.safari-map')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.safari-position')).toContainText('1 steps');
});
