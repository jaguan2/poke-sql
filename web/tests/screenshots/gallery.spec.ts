import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { createSafariSession } from '../../src/features/safari/model';
import { nearSafariGrass, openSafariQuery } from '../fixtures/safari';
import type { SafariSession } from '../../src/features/safari/types';
import { TRAINER_THROW } from '../../src/shared/trainer/profile';
import routeTrainers from '../../src/features/safari/route-trainers.json' with { type: 'json' };
import { zoneById, movePosition } from '../../src/features/safari/zones';

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
  }, { theme, entries, safari: safari ?? { ...createSafariSession('forest'), catches: 12 } });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
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
  // Large walking maps can push lazy table sprites beyond the loading threshold.
  await page.locator('img').evaluateAll(images => { for (const image of images) image.loading = 'eager'; });
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await page.locator('.safari-route-trainer').evaluateAll(nodes => Promise.all([...new Set(nodes.map(node => getComputedStyle(node).backgroundImage.slice(5, -2)))].map(async file => {
    const image = new Image(); image.src = file; await image.decode();
  })));
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: path.join(output, name), fullPage, animations: 'disabled', style: 'details[open]::details-content { transition:none!important; block-size:auto!important; opacity:1!important; }' });
}

async function sql(page: Page, text: string, action = /Run query/) {
  if (await page.locator('.safari-encounter').count()) await openSafariQuery(page);
  await page.locator('.cm-content').fill(text);
  await page.getByRole('button', { name: action }).click();
}

test('get started', async ({ page }) => {
  await open(page, 'poke-ball');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await expect(page.locator('.catalog-question')).toHaveCount(25);
  await shoot(page, 'get-started.png');
});

test('unseen National Dex', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-slot.is-unseen')).toHaveCount(24);
  await shoot(page, 'pokedex-unseen.png');
});

test('PC dragging', async ({ page }) => {
  await open(page, 'great-ball');
  await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  const source = page.getByRole('button', { name: /^Slot \d+: Charizard/ });
  await expect(source).toBeVisible();
  const start = (await source.boundingBox())!, end = (await page.locator('.pc-slot').nth(11).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await expect(page.locator('.pc-drag-ghost')).toBeVisible();
  await shoot(page, 'pc-drag.png');
  await page.keyboard.press('Escape'); await page.mouse.up();
});

test('Kanto town and region map', async ({ page }) => {
  await open(page, 'poke-ball', createSafariSession('pallet-town'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pallet Town exploration map' })).toBeVisible();
  await shoot(page, 'kanto-pallet-town.png');
  await page.locator('.region-map > summary').click();
  await shoot(page, 'kanto-region-map.png');
});

test('Kanto forest', async ({ page }) => {
  await open(page, 'dusk-ball', createSafariSession('viridian-forest'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Viridian Forest encounter table' })).toBeVisible();
  await shoot(page, 'kanto-viridian-forest.png');
});

test('Hoenn town and region map', async ({ page }) => {
  await open(page, 'poke-ball', createSafariSession('littleroot-town'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Littleroot Town exploration map' })).toBeVisible();
  await shoot(page, 'hoenn-littleroot-town.png');
  await page.locator('.region-map > summary').click();
  await shoot(page, 'hoenn-region-map.png');
});

test('Hoenn woods', async ({ page }) => {
  await open(page, 'dusk-ball', createSafariSession('petalburg-woods'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Petalburg Woods encounter table' })).toBeVisible();
  await shoot(page, 'hoenn-petalburg-woods.png');
});

test('Johto town and area selector', async ({ page }) => {
  await open(page, 'poke-ball', createSafariSession('new-bark-town'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'New Bark Town exploration map' })).toBeVisible();
  await shoot(page, 'johto-new-bark-town.png');
  await page.locator('.region-map > summary').click();
  await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption('slowpoke-well-b1f');
  await shoot(page, 'johto-region-map.png');
});

test('Johto forest', async ({ page }) => {
  await open(page, 'dusk-ball', createSafariSession('ilex-forest'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ilex Forest encounter table' })).toBeVisible();
  await shoot(page, 'johto-ilex-forest.png');
});

test('Kanto music player', async ({ page }) => {
  await open(page, 'dusk-ball', createSafariSession('viridian-forest'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('link', { name: '♫ Music', exact: true }).click();
  await expect(page.getByLabel('Music track')).toHaveValue('kanto-viridian-forest');
  await expect(page.getByLabel('Follow area music')).toBeChecked();
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: path.join(output, 'kanto-area-music.png'), animations: 'disabled' });
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
    await sql(page, `SELECT id, name FROM pokedex WHERE name = '${name}';`, /Run query/);
    await expect(page.locator('.mystery-table tbody tr')).toHaveCount(index + 1);
  }
  await shoot(page, 'daily-mystery.png');
});

test('mystery throw and caught scene', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pokesql:mystery-round', JSON.stringify({ id: 'gallery-wailord', targetId: 321, level: 36, guessCount: 0, attempts: [] })));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'master-ball');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await sql(page, 'SELECT id FROM pokedex WHERE id = 321;', /Run query/);
  const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
  await expect(scene).toHaveClass(/is-catching/);
  await scene.evaluate((element, time) => element.getAnimations({ subtree: true }).forEach(animation => {
    animation.pause(); animation.currentTime = time;
  }), TRAINER_THROW.releaseDelayMs + 100);
  await scene.screenshot({ path: path.join(output, 'mystery-catch-throw.png'), animations: 'allow' });
  await scene.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.play()));
  await expect(scene).toHaveClass(/is-caught/);
  await expect(scene.locator('.encounter-caption')).toHaveText('Gotcha! Wailord was caught!');
  await scene.screenshot({ path: path.join(output, 'mystery-caught.png'), animations: 'disabled' });
});

test('forest route', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1800 });
  await open(page, 'dusk-ball');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Verdant Forest exploration map' })).toBeVisible();
  await shoot(page, 'safari-route.png');
});

test('SQL encounter', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1280 });
  await open(page, 'ultra-ball', { ...nearSafariGrass(), catches: 12,
    encounter: { id: 'gallery-caterpie', pokemonId: 10, level: 14, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
    draft: 'SELECT * FROM pokedex\nWHERE name = ',
  });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('button', { name: /Catch Pokémon/ })).toBeVisible();
  await shoot(page, 'safari-encounter.png');
  await openSafariQuery(page);
  await shoot(page, 'safari-query.png');
});

for (const [id, file, theme] of [
  ['route-3', 'kanto-route-trainers.png', 'great-ball'],
  ['route-104', 'hoenn-route-trainers.png', 'premier-ball'],
  ['route-30', 'johto-route-trainers.png', 'dusk-ball'],
] as const) {
  test(`${id} decorative trainers`, async ({ page }) => {
    const npc = routeTrainers.locations[id][0], zone = zoneById(id);
    const position = (['down', 'right', 'up', 'left'] as const).map(direction => movePosition(zone, npc, direction)).find(position => position !== npc)!;
    await open(page, theme, { ...createSafariSession(id), position });
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await expect(page.locator('.safari-route-trainer').first()).toBeInViewport();
    await shoot(page, file);
  });
}

test('Lapras catch', async ({ page }) => {
  await open(page, 'heal-ball', { ...nearSafariGrass('coast'), catches: 12,
    encounter: { id: 'gallery-lapras', pokemonId: 131, level: 37, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await sql(page, 'SELECT id, name, type1, type2 FROM pokedex WHERE id = 131;', /Catch Pokémon/);
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
  test(`tablet Johto at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'dive-ball', createSafariSession('new-bark-town'));
    await page.getByRole('button', { name: 'Explore', exact: true }).tap();
    await page.getByRole('button', { name: 'Got it', exact: true }).tap();
    await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
    await page.locator('.region-map > summary').tap();
    await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption('ilex-forest');
    await shoot(page, `tablet-johto-${viewport.width}.png`);
  });
}

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`tablet Hoenn at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'dive-ball', createSafariSession('littleroot-town'));
    await page.getByRole('button', { name: 'Explore', exact: true }).tap();
    await page.getByRole('button', { name: 'Got it', exact: true }).tap();
    await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
    await page.locator('.region-map > summary').tap();
    await shoot(page, `tablet-hoenn-${viewport.width}.png`);
  });
}

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`tablet Kanto at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, 'dive-ball', createSafariSession('pallet-town'));
    await page.getByRole('button', { name: 'Explore', exact: true }).tap();
    await page.getByRole('button', { name: 'Got it', exact: true }).tap();
    await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
    await shoot(page, `tablet-kanto-${viewport.width}.png`);
  });
}

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
  await page.getByRole('button', { name: 'Explore', exact: true }).tap();
  await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
  await expect(page.getByRole('button', { name: /Catch Pokémon/ })).toBeVisible();
  await shoot(page, 'tablet-safari.png');
});
});

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`Bag pockets at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await open(page, 'poke-ball');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
    await page.locator('.bag-page').getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.bag-effects')).toContainText('100 steps left');
    await shoot(page, `bag-${viewport.width}.png`);
    if (viewport.width === 1600) {
      await page.locator('.bag-page').getByRole('button', { name: 'Key Items', exact: true }).click();
      await page.locator('.bag-page').getByRole('button', { name: 'Activate', exact: true }).click();
      await expect(page.locator('.bag-effects')).toContainText('Active · 1 in 64');
      await shoot(page, 'bag-key-items.png');
    }
  });
}


test('Sinnoh native town map and adapted field art', async ({ page }) => {
  await open(page, 'poke-ball', createSafariSession('twinleaf-town'));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Twinleaf Town exploration map' })).toBeVisible();
  await shoot(page, 'sinnoh-twinleaf-town.png');
  await page.locator('.region-map > summary').click();
  await page.setViewportSize({ width: 1600, height: 1500 });
  await shoot(page, 'sinnoh-region-map.png');
});


for (const area of ['route-201', 'eterna-forest'] as const) {
  test(`expanded Sinnoh walking map ${area}`, async ({ page }) => {
    await open(page, 'poke-ball', createSafariSession(area));
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await shoot(page, `sinnoh-${area}.png`);
  });
}
