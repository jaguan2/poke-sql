import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { createSafariSession } from '../../src/features/safari/model';
import { nearSafariGrass } from '../fixtures/safari';
import type { SafariSession } from '../../src/features/safari/types';

const output = path.resolve(process.env.POKESQL_SCREENSHOT_DIR ?? '../docs/screenshots');
const demoIds = [1, 4, 6, 7, 10, 25, 38, 131, 133, 150, 151, 181];

test.beforeAll(async () => { await mkdir(output, { recursive: true }); });

async function open(page: Page, theme: string, safari?: SafariSession, date = '2026-11-19T12:00:00Z') {
  const entries = await entriesFor(demoIds);
  await page.clock.setFixedTime(date);
  await page.addInitScript(({ theme, entries, safari }) => {
    localStorage.setItem('pokesql:ball-theme', JSON.stringify(theme));
    localStorage.setItem('pokesql:trainer', '"wally"');
    localStorage.setItem('pokesql:trainer-name', '"Jason"');
    localStorage.setItem('pokesql:trainer-id', JSON.stringify({ id: '14463', issuedAt: '2026-11-19T12:00:00.000Z' }));
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    localStorage.setItem('pokesql:completed', '["first-partners","charizard-profile","fast-ghosts","generation-counts"]');
    localStorage.setItem('pokesql:safari', JSON.stringify(safari));
    localStorage.setItem('pokesql:history', JSON.stringify(['SELECT name, hp FROM pokedex ORDER BY hp DESC LIMIT 10;', "SELECT name, type1, type2 FROM pokedex WHERE generation_id = 1;", "SELECT name FROM pokemon WHERE name = 'Charizard';"]));
  }, { theme, entries, safari: safari ?? { ...createSafariSession(), catches: 12 } });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
}

async function shoot(page: Page, name: string, fullPage = false) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  await page.locator('.main').evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  // Reject an unstyled capture even when its text and images have loaded.
  const menu = (await page.getByRole('complementary', { name: 'Workspace menu' }).boundingBox())!;
  const main = (await page.locator('main').boundingBox())!;
  expect(Math.abs(main.y - menu.y)).toBeLessThanOrEqual(1);
  expect(main.x).toBeGreaterThan(menu.x + menu.width);
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: path.join(output, name), fullPage, animations: 'disabled' });
}

async function sql(page: Page, text: string, action = /▶ Run/) {
  await page.locator('.cm-content').fill(text);
  await page.getByRole('button', { name: action }).click();
}

test('get started', async ({ page }) => {
  await open(page, 'poke-ball');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(25);
  await shoot(page, 'get-started.png');
});

test('challenges', async ({ page }) => {
  await open(page, 'great-ball');
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(15);
  await shoot(page, 'challenges.png');
});

test('SQL workspace', async ({ page }) => {
  await open(page, 'master-ball');
  await sql(page, "SELECT name, sprite_url, type1, type2, hp, speed, total_stats\nFROM pokedex\nWHERE name IN ('Venusaur', 'Charizard', 'Blastoise', 'Pikachu', 'Eevee', 'Dragonite')\nORDER BY id;");
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await shoot(page, 'sql-workspace.png');
});

test('daily mystery', async ({ page }) => {
  // A historical daily round avoids publishing the current puzzle in the gallery.
  await page.setViewportSize({ width: 1600, height: 1550 });
  await open(page, 'dive-ball', undefined, '2026-01-01T12:00:00Z');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  for (const [index, name] of ['Pikachu', 'Ampharos', 'Jolteon'].entries()) {
    await sql(page, `SELECT id, name FROM pokedex WHERE name = '${name}';`, /Guess Pokémon/);
    await expect(page.locator('.mystery-table tbody tr')).toHaveCount(index + 1);
  }
  await shoot(page, 'daily-mystery.png');
});

test('forest route', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1800 });
  await open(page, 'dusk-ball');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Verdant Forest exploration map' })).toBeVisible();
  await shoot(page, 'safari-route.png');
});

test('SQL encounter', async ({ page }) => {
  await open(page, 'ultra-ball', { ...nearSafariGrass(), catches: 12,
    encounter: { id: 'gallery-caterpie', pokemonId: 10, level: 14, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
    draft: 'SELECT id, name, type1, type2\nFROM pokedex\nWHERE name = \'Caterpie\';',
  });
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await shoot(page, 'safari-encounter.png');
});

test('Lapras catch', async ({ page }) => {
  await open(page, 'heal-ball', { ...nearSafariGrass('coast'), catches: 12,
    encounter: { id: 'gallery-lapras', pokemonId: 131, level: 37, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await sql(page, 'SELECT id, name, type1, type2 FROM pokedex WHERE id = 131;', /Check query & catch/);
  await expect(page.getByRole('article', { name: 'Lapras Pokédex entry', exact: true })).toBeVisible();
  await shoot(page, 'safari-catch.png');
  await page.getByRole('button', { name: 'Open PC Boxes', exact: true }).click();
  await page.getByRole('button', { name: 'Slot 13: Lapras, level 37', exact: true }).click();
  await shoot(page, 'pc-boxes.png');
  await page.getByRole('button', { name: 'Feature on profile', exact: true }).click();
  await page.getByRole('button', { name: 'View Trainer ID', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Pokémon', exact: true }).click();
  const choices = page.getByRole('group', { name: 'Caught Pokémon choices', exact: true });
  for (const name of ['Charizard', 'Pikachu', 'Eevee', 'Squirtle', 'Bulbasaur']) {
    const button = choices.getByRole('button', { name: new RegExp(`^${name}`) });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1600 });
  await shoot(page, 'featured-pokemon.png');
});

test('Pokédex', async ({ page }) => {
  await open(page, 'heal-ball');
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
  await shoot(page, 'pokedex.png');
});

test('achievements', async ({ page }) => {
  await open(page, 'luxury-ball');
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await shoot(page, 'achievements.png');
});

test('Trainer ID', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  await open(page, 'great-ball');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trainer ID', exact: true })).toBeFocused();
  await shoot(page, 'trainer-id.png');
});

test('settings', async ({ page }) => {
  await open(page, 'master-ball');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Poké Ball colors', exact: true }).getByRole('radio')).toHaveCount(8);
  await shoot(page, 'settings.png');
});

test('schema and guide', async ({ page }) => {
  await open(page, 'poke-ball');
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.locator('.table-name').filter({ hasText: /^pokedex$/ })).toBeVisible();
  await shoot(page, 'schema-guide.png');
});

test.describe('tablet gallery', () => {
  test.use({ isMobile: true, hasTouch: true });

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`tablet PC at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'poke-ball');
    await page.getByRole('button', { name: 'PC Boxes', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Slot 1: Bulbasaur', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Slot 1: Bulbasaur', exact: true }).tap();
    await shoot(page, `tablet-pc-${viewport.width}.png`);
  });
}

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`tablet schema at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'poke-ball');
    await page.getByRole('button', { name: 'Schema & guide', exact: true }).tap();
    await expect(page.getByRole('list', { name: 'pokedex columns', exact: true })).toBeVisible();
    await shoot(page, `tablet-schema-${viewport.width}.png`);
  });
}

test('portrait tablet SQL workspace', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, 'poke-ball');
  await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
  await sql(page, "SELECT name, sprite_url, type1, type2, hp\nFROM pokedex\nWHERE generation_id = 1\nORDER BY hp DESC\nLIMIT 5;");
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await shoot(page, 'tablet-workspace.png');
});

test('landscape tablet Safari', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, 'dive-ball', { ...nearSafariGrass('coast'), catches: 12,
    encounter: { id: 'gallery-tablet', pokemonId: 131, level: 37, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
    draft: 'SELECT id, name, type1, type2\nFROM pokedex\nWHERE name = \'Lapras\';',
  });
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).tap();
  await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await shoot(page, 'tablet-safari.png');
});
});
