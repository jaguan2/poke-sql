import { test, expect, type Page } from '@playwright/test';

async function edit(page: Page, sql: string) {
  // A completion popup can cover the editor's center. Focus its editable
  // content directly so replacing SQL cannot click a suggestion instead.
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await expect(page.locator('.cm-content')).toHaveText(sql);
}

async function guess(page: Page, sql: string) {
  await edit(page, sql);
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeVisible();
}

async function seedRound(page: Page, targetId = 6) {
  await page.addInitScript(targetId => {
    if (sessionStorage.getItem('mystery-test-seeded')) return;
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId, guessCount: 0, attempts: [] }));
    sessionStorage.setItem('mystery-test-seeded', 'yes');
  }, targetId);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
}

test('SQL guesses give green, yellow, and directional clues, then win for the exact species', async ({ page }) => {
  await seedRound(page, 149); // Dragonite: dragon/flying, Gen 1.
  await expect(page.getByText('Dragonite', { exact: true })).toHaveCount(0);
  await guess(page, 'SELECT id, name FROM pokedex WHERE id = 715'); // Noivern: flying/dragon, Gen 6.
  const near = page.locator('.mystery-table').getByRole('row').filter({ hasText: 'Noivern' });
  await expect(near.locator('.clue-partial')).toHaveCount(2);
  await expect(near).toContainText('↓ Earlier');
  await expect(near).toContainText('↑ Heavier');
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('1 guess');
  await guess(page, "SELECT id FROM pokedex WHERE name = 'Dragonite'");
  await expect(page.getByText('You found Dragonite in 2 guesses!', { exact: false })).toBeVisible();
  const found = page.getByRole('row').filter({ hasText: '2. Dragonite' });
  await expect(found.locator('.clue-correct')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
});

test('research and invalid queries do not use guesses or change the practice database', async ({ page }) => {
  await seedRound(page);
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await edit(page, "UPDATE pokemon SET name = 'Practice edit' WHERE id = 5; DROP VIEW pokedex;");
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mystery schema' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await guess(page, 'SELECT * FROM pokedex LIMIT 10');
  await expect(page.getByText('Research query only', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  await guess(page, 'SELECT COUNT(*) FROM pokemon');
  await expect(page.getByRole('cell', { name: '1,025', exact: true }).or(page.getByRole('cell', { name: '1025', exact: true }))).toBeVisible();
  await guess(page, 'DELETE FROM pokemon');
  await expect(page.getByRole('alert')).toContainText('one SELECT');
  await guess(page, 'SELECT 5 AS id; SELECT 6 AS id;');
  await expect(page.getByRole('alert')).toContainText('one SELECT');
  await guess(page, 'SELECT id, name FROM pokedex WHERE id = 5');
  await expect(page.getByRole('row').filter({ hasText: '1. Charmeleon' })).toContainText('↑ Taller');
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await edit(page, 'SELECT name FROM pokemon WHERE id = 5');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Practice edit', exact: true })).toBeVisible();
});

test('mystery target, notebook, and draft survive offline reload without replaying SQL', async ({ page, context }) => {
  await seedRound(page);
  const level = await page.locator('.encounter-nameplate small').textContent();
  await guess(page, 'SELECT id FROM pokedex WHERE id = 5');
  await edit(page, 'SELECT id FROM pokedex WHERE id = 6;');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
  await expect(page.locator('.cm-content')).toContainText('WHERE id = 6');
  await expect(page.locator('.encounter-nameplate h3')).toHaveText('???');
  await expect(page.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
  await expect(page.getByRole('row').filter({ hasText: '1. Charmeleon' })).toBeVisible();
  await expect(page.getByText('You found Charizard', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:mystery-round')!).targetId)).toBe(6);
  await page.locator('.cm-editor').click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('You found Charizard in 2 guesses!', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'New Pokémon', exact: true }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:mystery-round')!).targetId)).not.toBe(6);
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(0);
});

test('matching every trait still requires the correct Pokémon', async ({ page }) => {
  await seedRound(page, 311);
  await guess(page, 'SELECT * FROM pokedex WHERE id = 312');
  await expect(page.locator('.mystery-table .clue-correct')).toHaveCount(5);
  await expect(page.getByText('All five traits match, but this is a different species.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeEnabled();
  await expect(page.getByRole('img', { name: 'Mystery Pokémon', exact: true })).toBeVisible();
  await expect(page.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
});

test('cancellation preserves the mystery and does not add a guess', async ({ page }) => {
  await seedRound(page);
  await guess(page, 'SELECT id FROM pokedex WHERE id = 5');
  await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d');
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Query stopped');
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('1 guess');
  await guess(page, 'SELECT id FROM pokedex WHERE id = 6');
  await expect(page.getByText('You found Charizard in 2 guesses!', { exact: false })).toBeVisible();
});

test('new mysteries, schema previews, and storage failures never submit SQL implicitly', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokesql:mystery-round', '{"targetId":1,"guessCount":1,"attempts":[null]}');
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await page.getByRole('button', { name: '▶ SELECT * FROM pokedex', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('LIMIT 25');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText('This device could not save your SQL or progress.', { exact: false })).toBeVisible();
});

test('mystery clues, help, and controls remain reachable on desktop and mobile', async ({ page }, testInfo) => {
  await seedRound(page);
  await guess(page, 'SELECT id FROM pokedex WHERE id = 5');
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }, { width: 900, height: 480 }]) {
    await page.setViewportSize(viewport);
    const panel = page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true });
    await panel.getByText('How to play', { exact: true }).click();
    await panel.getByText('Several Pokémon can share all five traits.', { exact: false }).scrollIntoViewIfNeeded();
    await expect(panel.getByText('Several Pokémon can share all five traits.', { exact: false })).toBeInViewport();
    await panel.getByText('How to play', { exact: true }).click();
    const clues = page.getByRole('region', { name: 'Pokémon clue comparisons', exact: true });
    await clues.scrollIntoViewIfNeeded();
    await expect(clues).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`mystery-${viewport.width}.png`), fullPage: true });
    await page.locator('.workspace-status').scrollIntoViewIfNeeded();
    await expect(page.locator('.workspace-status')).toBeInViewport();
  }
});
