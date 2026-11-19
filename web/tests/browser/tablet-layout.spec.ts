import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

test.use({ isMobile: true, hasTouch: true });

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`touch SQL workspace works at ${viewport.width}x${viewport.height} and with reduced height`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
    const editor = page.locator('.cm-content');
    await editor.tap();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('SELECT name FROM pokemon WHERE id = 1;');
    await expect(page.locator('.editor-wrap .cm-editor')).toHaveCSS('font-size', '16px');
    const run = page.getByRole('button', { name: /▶ Run/ });
    expect((await run.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Emulates reduced browser space; this does not open a real iPad keyboard.
    await page.setViewportSize({ width: viewport.width, height: 520 });
    await expect(run).toBeInViewport({ ratio: 1 });
    await run.tap();
    await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.getByRole('button', { name: 'Get started', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeFocused();
    await page.getByLabel('Find a question').fill('Gen 1');
    await expect(page.getByRole('button', { name: 'All Pokémon from Gen 1', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test('tablet touch controls accept a SQL catch and retain the native game screen', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...nearSafariGrass(), encounter: { id: 'tablet-catch', pokemonId: 10, level: 14, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).tap();
  await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
  await page.locator('.cm-content').fill("SELECT id, name, type1, type2 FROM pokedex WHERE name = 'Caterpie';");
  const catchButton = page.getByRole('button', { name: /Check query & catch/ });
  expect((await catchButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await catchButton.tap();
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toBeVisible();
  const scene = (await page.locator('.safari-battle-scene').boundingBox())!;
  expect(scene.width / scene.height).toBeCloseTo(1.5, 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1180);
});
