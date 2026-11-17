import { test, expect, type Page } from '@playwright/test';

async function typeAfter(page: Page, prefix: string, word: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(prefix);
  await page.keyboard.type(word, { delay: 60 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('LEFT suggests LEFT JOIN and accepting it edits SQL without running it', async ({ page }, testInfo) => {
  await typeAfter(page, 'SELECT * FROM pokemon p ', 'LEFT');
  const suggestion = page.getByRole('option', { name: 'LEFT JOIN', exact: true });
  await expect(suggestion).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('left-join-suggestion.png'), fullPage: true });
  if (await suggestion.getAttribute('aria-selected') !== 'true') await page.keyboard.press('ArrowDown');
  await expect(suggestion).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM pokemon p LEFT JOIN');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await typeAfter(page, '', 'SELECT name FROM pokemon WHERE id = 1;');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});

test('phrase suggestions work alongside schema completion and ignore strings and comments', async ({ page }) => {
  for (const [word, phrase] of [['left', 'LEFT JOIN'], ['GROUP', 'GROUP BY'], ['ORDER', 'ORDER BY']]) {
    await typeAfter(page, 'SELECT * FROM pokemon ', word);
    await expect(page.getByRole('option', { name: phrase, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await typeAfter(page, 'SELECT * FROM ', 'poke');
  await expect(page.getByRole('option', { name: 'pokemon', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  for (const prefix of ["SELECT '", '-- ', '/* ']) {
    await typeAfter(page, prefix, 'LEFT');
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByRole('option', { name: 'LEFT JOIN', exact: true })).toHaveCount(0);
  }
});

test('autocomplete can be disabled, stays disabled after reload, and can be enabled again', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).toBeChecked();
  await page.getByRole('switch', { name: 'SQL autocomplete' }).uncheck();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await typeAfter(page, 'SELECT * FROM pokemon ', 'LEFT');
  await page.keyboard.press('ControlOrMeta+Space');
  // Wait beyond CodeMirror's typing delay before asserting that no list opens.
  await page.waitForTimeout(400);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'SQL autocomplete' }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await typeAfter(page, 'SELECT * FROM pokemon ', 'LEFT');
  await expect(page.getByRole('option', { name: 'LEFT JOIN', exact: true })).toBeVisible();
});

test('settings keep workspace controls inert, close with Escape, and preserve the draft', async ({ page }, testInfo) => {
  await typeAfter(page, '', 'SELECT 42;');
  await page.keyboard.press('Escape');
  const open = page.getByRole('button', { name: 'Settings', exact: true });
  await open.click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  await page.getByRole('radio', { name: 'Dive Ball', exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('settings-desktop.png'), fullPage: true });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    // Native dialogs may yield focus to browser chrome, but never to the
    // workspace behind the modal.
    expect(await page.locator('.app').evaluate(app => app.contains(document.activeElement) && !document.activeElement?.closest('dialog'))).toBe(false);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(open).toBeFocused();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42;');
});

test('invalid autocomplete preferences fall back to enabled and failed writes are explained in settings', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pokesql:autocomplete', JSON.stringify('false')));
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).toBeChecked();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByRole('switch', { name: 'SQL autocomplete' }).uncheck();
  await expect(page.getByText('This device could not save a setting.', { exact: false })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).not.toBeChecked();
});
