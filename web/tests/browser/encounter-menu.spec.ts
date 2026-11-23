import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';
test.use({ hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(session => {
    if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
    sessionStorage.setItem('pokesql:safari-controls-seen', 'yes'); Math.random = () => 0;
  }, nearSafariGrass());
});

test('the appearance dialogue becomes a command window; Catch opens SQL and Back retains its draft', async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click(); await page.keyboard.press('a');
  await expect(page.getByText('A wild Caterpie appeared!', { exact: true })).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveCount(0);
  const window = page.locator('.encounter-caption');
  await expect(window.getByRole('group', { name: 'Encounter commands' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('encounter-commands.png') });
  await page.keyboard.press('ArrowRight'); await expect(window.getByRole('button', { name: 'Run away', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
  const editor = page.locator('.cm-content'); await expect(editor).toBeFocused();
  await expect(editor).toHaveText('SELECT * FROM pokedex\nWHERE name = ', { useInnerText: true });
  await page.keyboard.insertText("'Caterpie';");
  await page.screenshot({ path: info.outputPath('encounter-sql.png') });
  await window.getByRole('button', { name: 'Back to encounter menu', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Catch Pokémon', exact: true })).toBeFocused();
  await window.getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  await expect(editor).toHaveText("SELECT * FROM pokedex\nWHERE name = 'Caterpie';", { useInnerText: true });
  await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  await expect(page.locator('.safari-battle-scene')).toHaveClass(/is-catching/);
  await expect(page.locator('.safari-assignment')).toHaveCount(0);
  await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures.map(capture => capture.pokemon.name)).toEqual(['Caterpie']);
});

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`touch command window and Run work without opening SQL at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click(); await page.keyboard.press('a');
    const menu = page.locator('.encounter-caption').getByRole('group', { name: 'Encounter commands' });
    await expect(menu).toBeVisible(); await expect(page.locator('.cm-content')).toHaveCount(0);
    const frame = (await page.locator('.safari-battle-scene').boundingBox())!;
    for (const button of await menu.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(frame.x); expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame.y + frame.height);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await menu.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('tablet-command-window.png') });
    await menu.getByRole('button', { name: 'Catch Pokémon', exact: true }).tap();
    await expect(page.locator('.cm-content')).toBeFocused();
    await menu.getByRole('button', { name: 'Back to encounter menu', exact: true }).tap();
    await expect(page.locator('.cm-content')).toHaveCount(0);
    await menu.getByRole('button', { name: 'Run away', exact: true }).tap();
    await expect(page.locator('.safari-map')).toBeVisible(); expect((await collectionSnapshot(page)).captures).toHaveLength(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter)).toBeNull();
  });
}
