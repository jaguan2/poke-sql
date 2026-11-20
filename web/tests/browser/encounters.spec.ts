import { test, expect, type Page } from '@playwright/test';
import { dailyPokemonForDate, createDailyMysteryRound } from '../../src/features/mystery/daily';
import { compareMysteryPokemon } from '../../src/features/mystery/model';
import type { PokemonProfile } from '../../src/shared/pokemon/profile';
import { entriesFor } from '../fixtures/pokemon-encounters';

async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await expect(page.locator('.cm-content')).toHaveText(sql);
}

async function guess(page: Page, id: number) {
  await edit(page, `SELECT id FROM pokedex WHERE id = ${id};`);
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
}

async function openPokedex(page: Page) {
  await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await expect(page.getByRole('heading', { name: 'My Pokédex', exact: true })).toBeVisible();
}

async function seedRandom(page: Page, targetId: number) {
  await page.addInitScript(target => {
    if (sessionStorage.getItem('encounters-seeded')) return;
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: target, guessCount: 0, attempts: [] }));
    sessionStorage.setItem('encounters-seeded', 'yes');
  }, targetId);
}

test('daily and random solved targets are collected, while research and wrong guesses add nothing', async ({ page }) => {
  await page.clock.setFixedTime('2026-01-01T12:00:00Z');
  await seedRandom(page, 6);
  await page.goto('/');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await edit(page, 'SELECT * FROM pokedex LIMIT 10;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.getByText('Research query only', { exact: false })).toBeVisible();
  await guess(page, 25);
  await openPokedex(page);
  await expect(page.getByText('No Pokémon registered', { exact: true })).toBeVisible();
  await expect(page.locator('.encounter-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await guess(page, dailyPokemonForDate('2026-01-01'));
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Raikou', exact: true })).toContainText('Daily mystery');
  await expect(page.getByRole('article', { name: 'Raikou', exact: true })).toContainText('Best solve: 2 guesses');
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await guess(page, 6);
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(2);
  const charizard = page.getByRole('article', { name: 'Charizard', exact: true });
  await expect(charizard).toContainText('Random practice');
  await expect(charizard.locator('.type-badge')).toHaveText(['fire', 'flying']);
  await expect.poll(() => charizard.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('progressbar', { name: 'Pokédex completion' })).toHaveAttribute('value', '2');
});

test('discoveries deduplicate across modes and survive offline reload, the next day, and reset', async ({ page, context }) => {
  await page.clock.setFixedTime('2026-01-01T12:00:00Z');
  const target = dailyPokemonForDate('2026-01-01');
  await seedRandom(page, target);
  await page.goto('/');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await guess(page, target);
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await guess(page, target);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:mystery-round')!).attempts.at(-1)?.feedback)).toMatchObject({ matched: true, pokemon: { id: target } });
  await openPokedex(page);
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.locator('.encounter-sources')).toHaveText('Daily mysteryRandom practice');
  const registeredAt = await page.locator('.encounter-card time').getAttribute('datetime');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await openPokedex(page);
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.locator('.encounter-card time')).toHaveAttribute('datetime', registeredAt!);
  await page.clock.setFixedTime('2026-01-02T12:00:00Z');
  await page.getByRole('button', { name: "Today's mystery", exact: true }).click();
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(0);
  await guess(page, dailyPokemonForDate('2026-01-02'));
  await page.getByRole('button', { name: 'Back to free practice', exact: true }).click();
  await edit(page, 'DROP TABLE pokemon;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.locator('.status-bar')).toContainText('Statement executed');
  await openPokedex(page);
  await expect(page.locator('.encounter-card')).toHaveCount(2);
  await expect(page.getByRole('article', { name: 'Raikou', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Reset DB', exact: true }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  await openPokedex(page);
  await expect(page.locator('.encounter-card')).toHaveCount(2);
});

test('existing saved solved rounds import once and the collection filters and paginates', async ({ page }) => {
  const entries = await entriesFor([...Array.from({ length: 30 }, (_, index) => index + 1), 133, 149, 243, 448]);
  const charizard = entries.find(entry => entry.pokemon.id === 6)!.pokemon;
  const raikou = entries.find(entry => entry.pokemon.id === 243)!.pokemon;
  await page.addInitScript(({ entries, charizard, raikou, daily }) => {
    if (sessionStorage.getItem('encounters-seeded')) return;
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    const attempt = (pokemon: PokemonProfile) => ({ sql: '', feedback: { pokemon, matched: true, type1: 'correct', type2: 'correct', generation: 'correct', height: 'correct', weight: 'correct' } });
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 6, guessCount: 1, attempts: [attempt(charizard)] }));
    localStorage.setItem('pokesql:daily-mystery-round', JSON.stringify({ ...daily, guessCount: 1, attempts: [attempt(raikou)] }));
    sessionStorage.setItem('encounters-seeded', 'yes');
  }, { entries, charizard, raikou, daily: createDailyMysteryRound('2026-01-01') });
  await page.goto('/');
  await openPokedex(page);
  await expect(page.getByRole('progressbar', { name: 'Pokédex completion' })).toHaveAttribute('value', '34');
  await expect(page.locator('.encounter-card')).toHaveCount(24);
  await page.getByRole('button', { name: /Show more Pokémon/ }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(34);
  await page.getByLabel('Sort discoveries', { exact: true }).selectOption('dex');
  await expect(page.locator('.encounter-card')).toHaveCount(24);
  await expect(page.locator('.encounter-card').first()).toContainText('Bulbasaur');
  await page.getByLabel('Search discovered Pokémon', { exact: true }).fill('#0006');
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toContainText('Best solve: 1 guess');
  await page.getByLabel('Search discovered Pokémon', { exact: true }).fill('pIkA');
  await expect(page.getByRole('article', { name: 'Pikachu', exact: true })).toBeVisible();
  await page.getByLabel('Generation', { exact: true }).selectOption('4');
  await expect(page.getByText('No discoveries match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByLabel('Generation', { exact: true }).selectOption('4');
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Lucario', exact: true })).toBeVisible();
  await page.reload();
  await openPokedex(page);
  await page.getByLabel('Search discovered Pokémon', { exact: true }).fill('Raikou');
  await expect(page.locator('.encounter-sources')).toContainText('Daily mystery');
});

test('saved wins are recovered when no collection exists and collection navigation never submits a draft', async ({ page }) => {
  const entries = await entriesFor([6, 243]);
  const charizard = entries[0].pokemon;
  const raikou = entries[1].pokemon;
  await page.addInitScript(({ charizard, raikou, randomFeedback, dailyFeedback, daily }) => {
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: charizard.id, guessCount: 2, attempts: [{ sql: '', feedback: randomFeedback }] }));
    localStorage.setItem('pokesql:daily-mystery-round', JSON.stringify({ ...daily, guessCount: 3, attempts: [{ sql: '', feedback: dailyFeedback }] }));
  }, { charizard, raikou, randomFeedback: compareMysteryPokemon(charizard, charizard), dailyFeedback: compareMysteryPokemon(raikou, raikou), daily: createDailyMysteryRound('2026-01-01') });
  await page.goto('/');
  await edit(page, "UPDATE pokemon SET name = 'Should not run' WHERE id = 6;");
  await openPokedex(page);
  await expect(page.locator('.encounter-card')).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.cm-content')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('Should not run');
  await edit(page, 'SELECT name FROM pokemon WHERE id = 6;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.getByRole('cell', { name: 'Charizard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /Meet Charizard/ }).click();
  await edit(page, 'SELECT name FROM pokedex WHERE id = 6;');
  await openPokedex(page);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current challenge', exact: true })).toContainText('Meet Charizard');
  await expect(page.locator('.cm-content')).toHaveText('SELECT name FROM pokedex WHERE id = 6;');
  await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.getByRole('button', { name: /^My Pokédex/ })).toBeDisabled();
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
});

test('corrupt or blocked storage keeps the collection usable without claiming a durable save', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokesql:encounters', '[null]');
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 6, guessCount: 0, attempts: [] }));
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await page.goto('/');
  await openPokedex(page);
  await expect(page.getByText('No Pokémon registered', { exact: true })).toBeVisible();
  await expect(page.getByText('this device could not save it', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Try random practice', exact: true }).click();
  await guess(page, 6);
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
  await expect(page.getByText('this device could not save it', { exact: false })).toBeVisible();
});

test('personal Pokédex cards and filters fit mobile and desktop without nested mobile scrolling', async ({ page }, testInfo) => {
  const entries = await entriesFor([6, 25, 448]);
  await page.addInitScript(entries => localStorage.setItem('pokesql:encounters', JSON.stringify(entries)), entries);
  await page.goto('/');
  await openPokedex(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const card = page.getByRole('article', { name: 'Charizard', exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width <= 620) {
      expect(await page.locator('.app, .body, .main, .personal-pokedex').evaluateAll(elements => elements.some(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1))).toBe(false);
      await expect(page.getByRole('button', { name: 'Back to workspace', exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: testInfo.outputPath(`pokedex-${width}.png`) });
  }
});
