import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';
import { openSafariQuery } from '../fixtures/safari';

test('the full National Dex starts as silhouettes and filters by region and ownership', async ({ page }, info) => {
  await page.goto('/'); await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await expect(page.getByText('1,025 matching Pokémon', { exact: true })).toBeVisible();
  await expect(page.locator('.pokedex-slot')).toHaveCount(24);
  await expect(page.locator('.pokedex-slot.is-unseen')).toHaveCount(24);
  await expect(page.locator('.pokedex-species-sprite').first()).toHaveCSS('filter', 'brightness(0)');
  await page.getByLabel('Region', { exact: true }).selectOption('3');
  await expect(page.getByText('135 matching Pokémon', { exact: true })).toBeVisible();
  await expect(page.locator('.pokedex-slot').first()).toContainText('#0252');
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.getByText('No Pokémon owned yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByLabel('Search Pokédex', { exact: true }).fill('#1025');
  await expect(page.locator('.pokedex-slot')).toHaveCount(1);
  await expect(page.locator('.pokedex-slot h3')).toHaveText('???');
  await page.getByLabel('Search Pokédex', { exact: true }).fill('');
  await page.screenshot({ path: info.outputPath('national-pokedex-silhouettes.png') });
});

test('a sighting reveals an entry, running preserves it, and a successful throw adds ownership', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const session = { ...nearSafariGrass(), encounter: { id: 'dex-sighting', pokemonId: 10, level: 14,
    assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 } };
  await page.addInitScript(session => {
    if (sessionStorage.getItem('dex-seeded')) return;
    sessionStorage.setItem('dex-seeded', 'yes'); localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, session);
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Run away', exact: true }).click();
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('seen');
  await expect(page.locator('.pokedex-slot.is-seen')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Caterpie', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
  await page.reload(); await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('seen');
  await expect(page.locator('.pokedex-slot.is-seen')).toHaveCount(1);
  await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify({ ...session, encounter: { ...session.encounter, id: 'dex-catch' } })), session);
  await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await openSafariQuery(page);
  await page.locator('.cm-content').fill("SELECT id, name, type1, type2 FROM pokedex WHERE id = 10;");
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.safari-encounter.is-catching')).toBeVisible();
  await expect(page.locator('.encounter-trainer')).toHaveClass(/is-throwing/);
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.locator('.pokedex-slot.is-owned')).toHaveCount(1);
  await expect(page.locator('.pokedex-owned-ball')).toHaveAttribute('alt', 'Owned');
  expect((await collectionSnapshot(page)).captures.map(item => item.pokemon.id)).toEqual([10]);
  await page.screenshot({ path: info.outputPath('pokedex-owned-entry.png') });
});

test('two open tabs merge sightings without granting ownership or losing either species', async ({ page, context }) => {
  const second = await context.newPage();
  for (const [tab, id] of [[page, 10], [second, 13]] as const) {
    await tab.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), { ...nearSafariGrass(),
      encounter: { id: `two-tabs-${id}`, pokemonId: id, level: 10, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
    });
    await tab.goto('/'); await tab.locator('.cm-content').waitFor();
  }
  for (const tab of [page, second]) {
    await tab.getByRole('button', { name: 'Explore', exact: true }).click();
    await tab.getByRole('button', { name: 'Run away', exact: true }).click();
  }
  for (const tab of [page, second]) {
    await tab.getByRole('button', { name: 'My Pokédex', exact: true }).click();
    await tab.getByLabel('Status', { exact: true }).selectOption('seen');
    await expect(tab.locator('.pokedex-slot.is-seen')).toHaveCount(2);
    expect((await collectionSnapshot(tab)).captures).toHaveLength(0);
  }
});

test('a concealed tracking encounter does not reveal its answer through Seen entries', async ({ page }) => {
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...nearSafariGrass('volcano'), encounter: { id: 'concealed-dex', pokemonId: 58, level: 8,
      assignmentId: 'tracking', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('heading', { name: '???', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run away', exact: true }).click();
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('seen');
  await expect(page.getByText('0 matching Pokémon', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByLabel('Search Pokédex', { exact: true }).fill('#0058');
  await expect(page.getByRole('article', { name: 'Unseen Pokémon #0058', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures).toHaveLength(0);
});
