import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
});

test('ball themes change the visible palette and use bundled icons offline', async ({ page, context }, testInfo) => {
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Poké Ball colors', exact: true }).getByRole('radio')).toHaveCount(8);
  const palettes = [
    ['Poké Ball', 'rgb(188, 70, 88)', 'rgb(250, 248, 242)'],
    ['Great Ball', 'rgb(53, 102, 160)', 'rgb(246, 249, 252)'],
    ['Ultra Ball', 'rgb(53, 55, 62)', 'rgb(44, 47, 54)'],
    ['Master Ball', 'rgb(118, 82, 154)', 'rgb(250, 247, 253)'],
    ['Heal Ball', 'rgb(231, 174, 194)', 'rgb(255, 249, 248)'],
    ['Dive Ball', 'rgb(40, 124, 155)', 'rgb(244, 251, 251)'],
    ['Dusk Ball', 'rgb(59, 101, 75)', 'rgb(39, 53, 46)'],
    ['Luxury Ball', 'rgb(52, 48, 52)', 'rgb(45, 41, 47)'],
  ];
  for (const [name, shell, panel] of palettes) {
    await page.getByRole('radio', { name, exact: true }).check();
    await expect(page.locator('.app')).toHaveCSS('background-color', shell);
    await expect(page.locator('.main')).toHaveCSS('background-color', panel);
    await expect.poll(() => page.locator('.theme-option img').evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-')}.png`), fullPage: true });
  }
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Luxury Ball', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('SELECT name FROM pokemon WHERE id = 1;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset DB' }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Luxury Ball', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
});

test('switching themes preserves the SQL draft without executing it on reload', async ({ page }) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('DROP TABLE pokemon;');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Master Ball', exact: true }).check();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Master Ball', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('DROP TABLE pokemon;');
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.locator('.table-name').filter({ hasText: /^pokemon$/ })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('unknown saved themes fall back and blocked storage still allows a session theme', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pokesql:ball-theme', JSON.stringify('missing-ball')));
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Poké Ball', exact: true })).toBeChecked();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByRole('radio', { name: 'Heal Ball', exact: true }).check();
  await expect(page.getByText('This device could not save a profile change.', { exact: false })).toBeVisible();
  await expect(page.locator('.app')).toHaveCSS('background-color', 'rgb(231, 174, 194)');
});

test('the picker and run controls fit narrow and intermediate screens', async ({ page }, testInfo) => {
  for (const width of [390, 680]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'Ultra Ball', exact: true }).check();
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Challenges', exact: true }).click();
    await page.getByRole('button', { name: /First partners/ }).click();
    for (const control of [page.getByRole('button', { name: 'Settings', exact: true }), page.getByRole('button', { name: 'Reset DB' }), page.getByRole('button', { name: /Check answer/ })]) {
      await expect(control).toBeInViewport({ ratio: 1 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`theme-${width}.png`), fullPage: true });
  }
});
