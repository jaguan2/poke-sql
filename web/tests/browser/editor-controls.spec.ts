import { test, expect, type Page } from '@playwright/test';
import { walkSafari } from '../../src/features/safari/model';
import { nearSafariGrass } from '../fixtures/safari';

async function replaceSql(page: Page, text: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(page.locator('.cm-content')).toHaveText(text, { useInnerText: true });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`editor footer runs SQL and undoes/redoes text at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const run = page.getByRole('button', { name: /Run query/ });
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const redo = page.getByRole('button', { name: 'Redo', exact: true });
    await expect(run).toBeVisible();
    await expect(page.getByLabel('Query name')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save query', exact: true })).toHaveCount(0);
    await expect(page.locator('.header-actions').getByRole('button', { name: /Run query/ })).toHaveCount(0);
    await expect(undo).toBeDisabled(); await expect(redo).toBeDisabled();
    const original = await page.locator('.cm-content').innerText();
    await replaceSql(page, 'SELECT 42 AS answer;');
    await expect(undo).toBeEnabled();
    await run.click();
    await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    await undo.click();
    await expect(page.locator('.cm-content')).toHaveText(original, { useInnerText: true });
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS answer;');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.cm-content')).toHaveText(original, { useInnerText: true });
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS answer;');
    await expect(redo).toBeDisabled();
    // Editing never executes or clears the last completed query.
    await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:history')!).length)).toBe(1);
    const editor = (await page.locator('.editor-wrap').boundingBox())!;
    for (const button of [undo, redo, run]) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(editor.y + editor.height);
      expect(box.y).toBeLessThanOrEqual(editor.y + editor.height + 16);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({ path: info.outputPath('editor-footer.png') });
    await page.reload();
    await expect(page.locator('.cm-content')).toHaveText('SELECT 42 AS answer;');
    await expect(undo).toBeDisabled(); await expect(redo).toBeDisabled();
  });
}

test('edit history cannot undo into a different practice or mystery draft', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
  await replaceSql(page, 'SELECT 42 AS free_practice;');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /First partners/ }).click();
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await expect(undo).toBeDisabled();
  const challenge = await page.locator('.cm-content').innerText();
  await replaceSql(page, "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');");
  await undo.click();
  await expect(page.locator('.cm-content')).toHaveText(challenge, { useInnerText: true });
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await expect(undo).toBeDisabled();
  await replaceSql(page, 'SELECT id FROM pokedex WHERE id = 1;');
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(undo).toBeDisabled();
  await expect(page.locator('.cm-content')).not.toContainText('free_practice');
});

test('Safari footer undoes text and still checks a catch assignment', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = walkSafari(nearSafariGrass(), 'left', 1, 0, 'editor-controls');
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), session);
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const catchQuery = page.getByRole('button', { name: /Check query & catch/ });
  await expect(catchQuery).toBeVisible();
  const original = await page.locator('.cm-content').innerText();
  await replaceSql(page, 'SELECT 42;');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText(original, { useInnerText: true });
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42;');
  await catchQuery.click();
  await expect(page.getByText('1 checked query', { exact: true })).toBeVisible();
  await expect(page.locator('.safari-assignment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
});
