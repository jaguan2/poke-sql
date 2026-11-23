import { test, expect, type Page } from '@playwright/test';
import { nearSafariGrass, openSafariQuery } from '../fixtures/safari';
import { entriesFor } from '../fixtures/pokemon-encounters';

async function submit(page: Page, sql: string) {
  await openSafariQuery(page);
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await page.getByRole('button', { name: /Catch Pokémon/ }).click();
}

test('a correct SQL catch reveals canonical Pokédex data and restores it offline', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.addInitScript(session => {
    if (sessionStorage.getItem('entry-seeded')) return;
    sessionStorage.setItem('entry-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    localStorage.setItem('pokesql:ball-theme', JSON.stringify('dive-ball'));
  }, {
    ...nearSafariGrass('coast'),
    encounter: { id: 'entry-lapras', pokemonId: 131, level: 37, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const entry = page.getByRole('article', { name: 'Lapras Pokédex entry', exact: true });
  const caughtMarker = page.getByRole('img', { name: 'Already in your Pokédex', exact: true });
  await expect(caughtMarker).toHaveCount(0);
  await expect(entry).toHaveCount(0);
  await submit(page, 'SELECT 1;');
  await expect(page.getByText('Not quite.', { exact: false })).toBeVisible();
  await expect(entry).toHaveCount(0);
  await expect(caughtMarker).toHaveCount(0);
  await submit(page, 'DELETE FROM pokemon;');
  await expect(page.getByRole('alert')).toContainText('one SELECT');
  await expect(entry).toHaveCount(0);
  await submit(page, 'SELECT id, name, type1, type2 FROM pokedex WHERE id=131;');
  await expect(entry).toBeVisible();
  await expect(caughtMarker).toBeVisible();
  await expect(entry.getByRole('heading', { name: 'Lapras', exact: true })).toBeVisible();
  await expect(entry).toContainText('Transport Pokémon');
  await expect(entry.locator('.type-badge')).toHaveText(['water', 'ice']);
  await expect(entry.locator('dd')).toHaveText(['2.5 m', '220 kg', '1']);
  await expect(entry.locator('.safari-entry-description')).toContainText('Crossing icy seas');
  await expect(entry.locator('footer')).toContainText('Pokémon Shield');
  await expect(page.getByRole('region', { name: 'Caught Pokémon details', exact: true })).toBeFocused();
  await expect(page.locator('.safari-catch-summary')).toContainText('Completed in 2 queries.');
  await expect(page.locator('.encounter-nameplate small')).toHaveText('Lv.37');
  await page.locator('.safari-encounter').screenshot({ path: info.outputPath('lapras-wide-catch.png'), animations: 'disabled' });
  await page.screenshot({ path: info.outputPath('lapras-wide-window.png'), animations: 'disabled' });
  await entry.screenshot({ path: info.outputPath('lapras-pokedex-entry.png'), animations: 'disabled' });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(entry.locator('dd')).toHaveText(['2.5 m', '220 kg', '1']);
  await expect(caughtMarker).toBeVisible();
  await expect(entry.locator('.safari-entry-description')).toContainText('Crossing icy seas');
  expect(await entry.getByRole('img', { name: 'Lapras', exact: true }).evaluate(async (img: HTMLImageElement) => {
    await img.decode(); return img.naturalWidth;
  })).toBe(96);
  await expect(page.locator('.safari-pass strong')).toHaveText('01');
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(entry).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Azure Coast exploration map' })).toBeVisible();
  await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.getByRole('article', { name: 'Lapras', exact: true })).toBeVisible();
});

for (const width of [320, 390, 620]) {
  test(`a restored catch reveals a readable Pokédex entry at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const [discovery] = await entriesFor([10]);
    await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...nearSafariGrass(), catches: 1,
      encounter: { id: 'legacy-catch', pokemonId: 10, assignmentId: 'field-notes', attempts: 1, outcome: 'caught', fleeAfter: null },
      lastCatch: { encounterId: 'legacy-catch', pokemon: discovery.pokemon, attempts: 1, caughtAt: discovery.firstFoundAt },
      draft: 'DELETE FROM pokemon;',
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const entry = page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true });
    await expect(entry).toContainText('Worm Pokémon');
    await expect(entry.locator('.type-badge')).toHaveText(['bug']);
    await expect(entry.locator('dd')).toHaveText(['0.3 m', '2.9 kg', '1']);
    await expect(entry.locator('.safari-entry-description')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await entry.screenshot({ path: info.outputPath(`caterpie-entry-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Verdant Forest exploration map' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).catches)).toBe(1);
  });
}

test('an already registered Pokémon shows a ball before the catch and keeps one journal record', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const [discovery] = await entriesFor([10]);
  await page.addInitScript(({ session, discovery }) => {
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    localStorage.setItem('pokesql:encounters', JSON.stringify([discovery]));
  }, {
    session: { ...nearSafariGrass(), catches: 1,
      encounter: { id: 'repeat-catch', pokemonId: 10, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: null },
    }, discovery,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const nameplate = page.locator('.encounter-nameplate');
  const caughtMarker = nameplate.getByRole('img', { name: 'Already in your Pokédex', exact: true });
  await expect(caughtMarker).toBeVisible();
  await caughtMarker.evaluate((img: HTMLImageElement) => img.decode());
  await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath('registered-caterpie.png'), animations: 'disabled' });
  await submit(page, 'SELECT id, name, type1, type2 FROM pokedex WHERE id=10;');
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toContainText('Worm Pokémon');
  await expect(page.locator('.safari-pass strong')).toHaveText('02');
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('owned');
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Caterpie', exact: true })).toContainText('Safari Zone');
});
