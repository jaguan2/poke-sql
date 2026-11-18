import { test, expect } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';

test('the wetlands route crosses the bridge between its two banks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.safari-area-picker > summary').click();
  await page.getByRole('button', { name: /Willow Wetlands/ }).click();
  const map = page.getByRole('group', { name: 'Willow Wetlands exploration map' });
  await map.focus();
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(130);
  }
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '20');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '23');
  await expect(page.locator('.safari-position')).toContainText('14 steps');
  await expect(page.locator('.safari-pass strong')).toHaveText('00');
});

test('a route scrolls with the trainer, shows an overview, and restores the same trail position', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  const map = page.getByRole('group', { name: 'Verdant Forest exploration map' });
  await expect(map).toHaveAttribute('data-camera-y', '10');
  const before = await page.locator('.safari-terrain').boundingBox();
  await map.focus();
  for (const key of [...Array(3).fill('ArrowUp'), ...Array(3).fill('ArrowLeft'), ...Array(6).fill('ArrowUp')]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(130);
  }
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '8');
  await expect(map).toHaveAttribute('data-camera-y', '3');
  await expect(page.locator('.safari-player')).toBeInViewport();
  expect((await page.locator('.safari-terrain').boundingBox())!.y).toBeGreaterThan(before!.y + 100);
  await expect(page.locator('.safari-position')).toContainText('12 steps');
  await page.screenshot({ path: info.outputPath('winding-route.png'), animations: 'disabled' });
  await page.locator('.safari-route-overview > summary').click();
  await expect(page.getByRole('img', { name: /Canopy Trail overview/ })).toBeVisible();
  await page.locator('.safari-route-overview').screenshot({ path: info.outputPath('route-overview.png') });
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '8');
  await expect(map).toHaveAttribute('data-camera-y', '3');
  await page.setViewportSize({ width: 320, height: 844 });
  await map.scrollIntoViewIfNeeded();
  await expect(page.locator('.safari-player')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('route-mobile.png') });
});

test('old clearing saves retain catches, active SQL, and attempts when moved to the new route trailhead', async ({ page }) => {
  const [entry] = await entriesFor([10]);
  await page.addInitScript(pokemon => {
    if (sessionStorage.getItem('old-clearing')) return;
    sessionStorage.setItem('old-clearing', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify({
      version: 1, zoneId: 'forest', position: { x: 5, y: 6 }, direction: 'left',
      steps: 47, grassSteps: 0, catches: 1,
      encounter: { id: 'old-grass', pokemonId: 13, assignmentId: 'stat-scan', attempts: 2, caught: false },
      draft: 'SELECT name, hp, attack, speed FROM pokemon WHERE id=13;',
      lastCatch: { encounterId: 'previous-catch', pokemon, attempts: 1, caughtAt: '2026-11-18T12:00:00.000Z' },
    }));
  }, entry.pokemon);
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stat scan', exact: true })).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveText('SELECT name, hp, attack, speed FROM pokemon WHERE id=13;');
  await expect(page.locator('.safari-query-actions')).toContainText('2 checked queries');
  await expect(page.locator('.safari-pass strong')).toHaveText('01');
  await expect(page.locator('.safari-wild-sprite')).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!))).toMatchObject({
    version: 2, position: { x: 10, y: 17 }, steps: 47, catches: 1,
    encounter: { id: 'old-grass', attempts: 2, caught: false },
  });
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByText('Gotcha! Weedle was caught!', { exact: true })).toBeVisible();
  await expect(page.locator('.safari-catch-summary')).toContainText('Completed in 3 queries.');
  await expect(page.locator('.safari-pass strong')).toHaveText('02');
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(2);
});
