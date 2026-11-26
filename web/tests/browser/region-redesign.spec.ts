import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1050 }, { width: 820, height: 1180 }]) {
  test(`rebuilt towns and routes load local art at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.getByRole('button', { name: 'Hide menu', exact: true }).click();
    for (const [region, id, name] of [
      ['Unova', 'nuvema-town', 'Nuvema Town'], ['Unova', 'striaton-city', 'Striaton City'],
      ['Unova', 'nacrene-city', 'Nacrene City'], ['Unova', 'castelia-city', 'Castelia City'],
      ['Unova', 'nimbasa-city', 'Nimbasa City'], ['Unova', 'unova-route-3', 'Route 3'],
      ['Unova', 'unova-route-4', 'Route 4'], ['Sinnoh', 'jubilife-city', 'Jubilife City'],
      ['Sinnoh', 'floaroma-town', 'Floaroma Town'],
    ]) {
      await page.locator('.region-map > summary').click();
      await page.getByRole('navigation', { name: 'Regions' }).getByRole('button', { name: region, exact: true }).click();
      await page.getByLabel('Area', { exact: true }).selectOption(id);
      await page.getByRole('button', { name: `Travel to ${name}`, exact: true }).click();
      const map = page.getByRole('group', { name: `${name} exploration map`, exact: true });
      await expect(map).toBeVisible();
      await expect(map.locator('.safari-terrain')).toHaveJSProperty('complete', true);
      expect(await map.locator('.safari-terrain').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await map.screenshot({ path: info.outputPath(`${id}.png`) });
    }
  });
}
