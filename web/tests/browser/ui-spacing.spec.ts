import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test.describe(`page alignment at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width !== 1600, isMobile: viewport.width !== 1600 });

    test('pages share a compact content edge and navigation stays aligned', async ({ page }, info) => {
      await page.goto('/');
      const menu = page.getByRole('complementary', { name: 'Workspace menu' });
      const main = page.locator('main');
      const sidebar = (await menu.boundingBox())!;
      expect(Math.abs(sidebar.y - (await main.boundingBox())!.y)).toBeLessThanOrEqual(1);
      const icons = await menu.locator('.navigation-icon').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
      expect(Math.max(...icons) - Math.min(...icons)).toBeLessThanOrEqual(1);
      const labels = await menu.locator('.nav-label').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
      expect(Math.max(...labels) - Math.min(...labels)).toBeLessThanOrEqual(1);
      for (const button of await menu.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      const insets: number[] = [];
      for (const [destination, content] of [
        ['Schema & guide', '.workspace-library'], ['Get started', '.practice-catalog'], ['Challenges', '.practice-catalog'],
        ['Profiles', '.profiles-page'], ['Settings', '.profiles-page'], ['My Pokédex', '.personal-pokedex'],
        ['Safari Zone', '.safari-zone'], ['History', '.workspace-library'], ['Saved', '.workspace-library'],
      ]) {
        await page.getByRole('button', { name: destination, exact: true }).click();
        const heading = page.locator(content).getByRole('heading', { level: 2 }).first();
        await expect(heading).toBeVisible();
        const inset = (await heading.boundingBox())!.x - (await main.boundingBox())!.x;
        insets.push(inset);
        expect(inset).toBeLessThanOrEqual(24);
        expect(inset).toBeGreaterThanOrEqual(12);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        expect(await main.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      }
      expect(Math.max(...insets) - Math.min(...insets)).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
      await page.screenshot({ path: info.outputPath('aligned-schema.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Hide menu', exact: true }).click();
      const rail = (await menu.boundingBox())!;
      const centers = await menu.locator('.navigation-icon').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect(); return rect.x + rect.width / 2;
      }));
      for (const center of centers) expect(Math.abs(center - rail.x - rail.width / 2)).toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Schema & guide', exact: true })).toHaveAttribute('aria-current', 'page');
    });
  });
}
