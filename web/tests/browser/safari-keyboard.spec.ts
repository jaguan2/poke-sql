import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

test('the introductory controls popup dismisses once per session and leaves the route free of direction buttons', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  const popup = page.getByRole('complementary', { name: 'Safari controls', exact: true });
  await expect(popup).toContainText('Use WASD or arrow keys to walk.');
  await expect(popup).toContainText('swipe the map');
  await expect(page.getByRole('button', { name: /^Move (up|down|left|right)$/ })).toHaveCount(0);
  await popup.scrollIntoViewIfNeeded();
  const popupBounds = (await popup.boundingBox())!;
  const mapBounds = (await page.locator('.safari-map').boundingBox())!;
  expect(popupBounds.y).toBeGreaterThanOrEqual(mapBounds.y);
  expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('safari-controls-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('.safari-field').screenshot({ path: info.outputPath('safari-controls-desktop.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.keyboard.press('a');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '9');
});

test('WASD and arrows keep walking after clicking outside the map and pause for settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Safari controls', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: /Safari Zone/ }).click();
  const player = page.locator('.safari-player');
  for (const [key, x, y] of [
    ['a', 9, 17], ['d', 10, 17], ['w', 10, 16], ['s', 10, 17],
    ['ArrowLeft', 9, 17], ['ArrowRight', 10, 17], ['ArrowUp', 10, 16], ['ArrowDown', 10, 17],
  ] as const) {
    await page.keyboard.press(key);
    await expect(player).toHaveAttribute('data-x', String(x));
    await expect(player).toHaveAttribute('data-y', String(y));
    await expect(page.getByRole('complementary', { name: 'Safari controls', exact: true })).toHaveCount(0);
    await page.waitForTimeout(130);
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dusk Ball', exact: true }).check();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Luxury Ball', exact: true })).toBeChecked();
  await page.keyboard.press('w');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).position.y)).toBe(17);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.keyboard.press('a');
  await expect(player).toHaveAttribute('data-x', '9');
  await page.locator('audio').focus();
  await page.keyboard.press('ArrowRight');
  await expect(player).toHaveAttribute('data-x', '9');
  await page.waitForTimeout(130); // Respect the walking cadence before the next movement input.
  await page.getByRole('heading', { name: /Safari Zone/ }).click();
  await page.keyboard.press('d');
  await expect(player).toHaveAttribute('data-x', '10');
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('wasd');
  await expect(page.locator('.cm-content')).toHaveText('wasd');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).position)).toEqual({ x: 10, y: 17 });
});

test('the habitat picker pauses walking and a newly chosen route accepts keys immediately', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.safari-area-picker > summary').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '10');
  await page.getByRole('button', { name: /Willow Wetlands/ }).click();
  await page.keyboard.press('a');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '33');
  await page.keyboard.press('Control+ArrowLeft');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '33');
  await page.waitForTimeout(130);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '32');
});

test('keyboard grass encounters roll from the visible weighted table and SQL alone registers the catch', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.clock.setFixedTime('2026-11-18T12:00:00Z');
  await page.addInitScript(session => {
    Math.random = () => 0;
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, nearSafariGrass());
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  const table = page.getByRole('table', { name: 'Verdant Forest encounter table' });
  await expect(table.getByRole('row', { name: 'Caterpie: not yet found', exact: true }).getByRole('cell')).toHaveText('14.6%');
  await expect(table.getByRole('row', { name: 'Exeggcute: not yet found', exact: true }).getByRole('cell')).toHaveText('7.3%');
  await page.locator('.safari-field-guide').screenshot({ path: info.outputPath('encounter-table.png'), animations: 'disabled' });
  await table.getByRole('columnheader', { name: 'Next roll', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.getByText('Something is moving in the grass!', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Wild Caterpie', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await page.locator('.cm-content').focus();
  await page.keyboard.type('wasd');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).position)).toEqual({ x: 3, y: 17 });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('SELECT id, name, type1, type2 FROM pokedex WHERE id=10;');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(table.getByRole('row', { name: 'Caterpie: registered', exact: true }).getByRole('cell')).toHaveText('Resting');
  await expect(table.getByRole('row', { name: 'Weedle: not yet found', exact: true }).getByRole('cell')).toHaveText('17.1%');
  await expect(page.getByRole('progressbar', { name: 'Verdant Forest collection progress' })).toHaveAttribute('value', '1');
});
