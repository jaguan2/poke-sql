import { test, expect } from '@playwright/test';

test('hiding the menu expands the workspace and preserves the draft, selected tool and results', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const menu = page.getByRole('complementary', { name: 'Workspace menu' });
  const toggle = page.locator('.menu-button');
  await expect(menu).toBeVisible();
  await page.locator('.cm-content').fill("SELECT name FROM pokemon WHERE id = 1;");
  const before = (await page.locator('main').boundingBox())!.width;
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAccessibleName('Show menu');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveClass(/is-collapsed/);
  expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(before + 150);
  await expect(toggle).toBeFocused();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('menu-hidden-desktop.png') });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Free practice', exact: true })).toHaveAttribute('aria-current', 'page');
  await toggle.click();
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
  await toggle.click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show menu', exact: true })).toBeVisible();
  await expect(menu).toHaveClass(/is-collapsed/);
  await expect(page.locator('.cm-content')).toHaveText('SELECT name FROM pokemon WHERE id = 1;');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await toggle.click();
  await expect(menu).toBeVisible();
});

for (const width of [320, 620, 760, 850, 1440]) {
  test(`menu controls fit and reopen at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const toggle = page.locator('.menu-button');
    await expect(toggle).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Profiles', exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Show menu', exact: true })).toBeInViewport({ ratio: 1 });
    if (width <= 620) await expect(page.locator('.sidebar')).toBeHidden();
    else { await expect(page.locator('.sidebar')).toHaveClass(/is-collapsed/); await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible(); }
    await expect(page.locator('.cm-content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`menu-hidden-${width}.png`) });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Safari Zone', exact: true })).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
}
