import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';
import { createBag } from '../../src/features/safari/bag-model';

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`Bag uses and saves Repel without spending steps while the window is open at ${viewport.width}`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await page.locator('.cm-content').waitFor();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), { ...nearSafariGrass(), bag: { ...createBag(), used: { repel: 999, 'super-repel': 999, 'max-repel': 999 } } });
    await page.reload(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
    const bag = page.locator('.bag-page');
    await expect(bag.getByRole('heading', { name: 'Bag', exact: true })).toBeVisible();
    await bag.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(bag.getByLabel('Active item effects')).toContainText('100 steps left');
    await expect(bag.getByRole('button', { name: 'Repel Unlimited', exact: true })).toBeVisible();
    await expect(bag.getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    await page.keyboard.press('a');
    await expect(bag.getByLabel('Active item effects')).toContainText('100 steps left');
    await page.screenshot({ path: info.outputPath('bag.png') });
    await bag.getByRole('button', { name: 'Close Bag' }).click(); await page.keyboard.press('a');
    await expect(page.locator('.safari-item-bar')).toContainText('99 steps left');
    await expect(page.locator('.safari-map')).toBeVisible();
    await expect(page.locator('.safari-battle-scene')).toHaveCount(0);
    await page.getByText('Available offline', { exact: true }).waitFor();
    await context.setOffline(true); await page.reload();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.locator('.bag-effects')).toContainText('99 steps left');
    await expect(page.locator('.bag-page').getByRole('button', { name: 'Repel Unlimited', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('.bag-page img, .navigation-bag').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(page.locator('.bag-illustration img')).toHaveAttribute('src', /safari\/bag\.png$/);
    const geometry = await bag.boundingBox(); expect(geometry!.width).toBeLessThanOrEqual(viewport.width);
  });
}

test('Charm unlock, activation and disabling work; encounter items remain unavailable during a catch', async ({ page }, info) => {
  await page.goto('/'); await page.locator('.cm-content').waitFor();
  await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), { ...nearSafariGrass(), catches: 10, grassSteps: 5, bag: createBag() });
  await page.reload(); const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Bag', exact: true }).click();
  const bag = page.locator('.bag-page'); await bag.getByRole('button', { name: 'Key Items', exact: true }).click();
  await bag.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(bag.locator('.bag-effects')).toContainText('Active · 1 in 64');
  await page.screenshot({ path: info.outputPath('charm.png') });
  await bag.getByRole('button', { name: 'Put away', exact: true }).click();
  await expect(bag.locator('.bag-effects')).toContainText('Inactive · 1 in 128');
  await bag.getByRole('button', { name: 'Close Bag' }).click();
  await expect(page.locator('.safari-guide-note')).toContainText('1 in 128');
  await page.keyboard.press('a'); await expect(page.getByRole('group', { name: 'Encounter commands', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Bag', exact: true }).click();
  await expect(bag.getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
  await expect(bag.getByRole('status')).toContainText('Return to the route');
});

test('new trainers see the Charm requirement and menu links open Trainer ID and Options', async ({ page }) => {
  await page.goto('/'); const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Bag', exact: true }).click();
  await page.getByRole('button', { name: 'Key Items', exact: true }).click();
  await expect(page.locator('.bag-page').getByRole('button', { name: 'Activate' })).toBeDisabled();
  await expect(page.locator('.bag-description')).toContainText('0 / 10 catches');
  await nav.getByRole('button', { name: 'Trainer ID', exact: true }).click();
  await expect(page.locator('.profiles-page')).toBeVisible();
  await nav.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
});

test('a depleted old save can use another Repel after the last protected step', async ({ page }) => {
  await page.goto('/'); await page.locator('.cm-content').waitFor();
  await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...nearSafariGrass(), bag: { ...createBag(), repelSteps: 1, used: { repel: 999, 'super-repel': 999, 'max-repel': 999 } },
  });
  await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.keyboard.press('a'); await expect(page.locator('.safari-item-bar')).toContainText('Repel inactive');
  await expect(page.locator('.safari-map')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
  await page.locator('.bag-page').getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.locator('.bag-effects')).toContainText('100 steps left');
  await expect(page.locator('.bag-page').getByRole('button', { name: 'Repel Unlimited', exact: true })).toBeVisible();
});
