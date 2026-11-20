import { test, expect, type Page } from '@playwright/test';

async function typeAfter(page: Page, prefix: string, word: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(prefix);
  await page.keyboard.type(word, { delay: 60 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
});

test('LEFT suggests LEFT JOIN and accepting it edits SQL without running it', async ({ page }, testInfo) => {
  await typeAfter(page, 'SELECT * FROM pokemon p ', 'LEFT');
  const suggestion = page.getByRole('option', { name: 'LEFT JOIN', exact: true });
  await expect(suggestion).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('left-join-suggestion.png'), fullPage: true });
  // CodeMirror intentionally ignores completion navigation for 75 ms after
  // opening. A screenshot can finish sooner than that interaction guard.
  await page.waitForTimeout(100);
  if (await suggestion.getAttribute('aria-selected') !== 'true') await page.keyboard.press('ArrowDown');
  await expect(suggestion).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM pokemon p LEFT JOIN');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await typeAfter(page, '', 'SELECT name FROM pokemon WHERE id = 1;');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});

test('background offline status updates preserve active SQL completions', async ({ page }) => {
  // Drive an actual parent-state update at a known point, rather than relying
  // on a service worker installation happening during the typing interval.
  await page.addInitScript(() => {
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    const registration = Object.assign(new EventTarget(), { active: null as EventTarget | null, installing, waiting: null });
    Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => registration });
    window.addEventListener('pokesql-test-offline-ready', () => {
      installing.state = 'activated';
      registration.active = installing;
      installing.dispatchEvent(new Event('statechange'));
    });
  });
  await page.reload();
  await expect(page.getByText('Preparing offline access…', { exact: true })).toBeVisible();
  await typeAfter(page, 'SELECT * FROM pokemon p ', 'LEFT');
  const suggestion = page.getByRole('option', { name: 'LEFT JOIN', exact: true });
  await expect(suggestion).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('pokesql-test-offline-ready')));
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
  await expect(suggestion).toBeVisible();
  // Respect the same completion interaction guard as a user's reading pause.
  await page.waitForTimeout(100);
  if (await suggestion.getAttribute('aria-selected') !== 'true') await page.keyboard.press('ArrowDown');
  await expect(suggestion).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM pokemon p LEFT JOIN');
  await expect(page.locator('tbody tr')).toHaveCount(0);
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

test('the settings icon opens a page, preserves the draft and never runs hidden SQL', async ({ page }, testInfo) => {
  await typeAfter(page, '', 'SELECT 42;');
  await page.keyboard.press('Escape');
  const open = page.getByRole('button', { name: 'Settings', exact: true });
  await open.click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dive Ball', exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('settings-desktop.png'), fullPage: true });
  await page.getByRole('switch', { name: 'SQL autocomplete' }).uncheck();
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(open).toBeFocused();
  await expect(page.locator('.cm-content')).toHaveText('SELECT 42;');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('invalid autocomplete preferences fall back to enabled and failed writes are explained in settings', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pokesql:autocomplete', JSON.stringify('false')));
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).toBeChecked();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByRole('switch', { name: 'SQL autocomplete' }).uncheck();
  await expect(page.getByText('This device could not save a profile change.', { exact: false })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).not.toBeChecked();
});
