import { test, expect } from '@playwright/test';

const regions = [
  { name: 'Kanto', game: 'Pokémon FireRed', width: 192, height: 144, target: 'Cerulean City', id: 'cerulean-city', x: 124, y: 44 },
  { name: 'Johto', game: 'Pokémon Crystal', width: 160, height: 144, target: 'Goldenrod City', id: 'goldenrod-city', x: 52, y: 92 },
  { name: 'Hoenn', game: 'Pokémon Emerald', width: 240, height: 160, target: 'Mauville City', id: 'mauville-city', x: 80, y: 68 },
  { name: 'Sinnoh', game: 'PokéSQL', width: 176, height: 152, target: 'Eterna Forest', id: 'eterna-forest', x: 54, y: 33 },
];

for (const viewport of [{ width: 1440, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  for (const region of regions) {
    test(`${region.name} native town map selects and travels at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport); await page.goto('/');
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await page.getByRole('button', { name: 'Hide menu', exact: true }).click();
      await page.locator('.region-map > summary').click();
      await page.getByRole('navigation', { name: 'Regions', exact: true }).getByRole('button', { name: region.name, exact: true }).click();
      const chart = page.getByRole('group', { name: `${region.name} region map`, exact: true });
      const image = chart.getByRole('img', { name: `${region.name} town map from ${region.game}`, exact: true });
      await expect(image).toHaveJSProperty('naturalWidth', region.width);
      await expect(image).toHaveJSProperty('naturalHeight', region.height);
      await expect(image).toHaveCSS('image-rendering', 'pixelated');
      const target = chart.getByRole('button', { name: `View ${region.target}`, exact: true });
      await target.focus(); await page.keyboard.press('Enter');
      await expect(page.getByLabel('Area', { exact: true })).toHaveValue(region.id);
      await expect(chart.locator('.region-map-caption')).toContainText(region.target);
      const art = (await image.boundingBox())!, cursor = (await chart.locator('.region-map-cursor').boundingBox())!;
      expect(Math.abs(art.width / art.height - region.width / region.height)).toBeLessThan(.01);
      expect(Math.abs(cursor.x + cursor.width / 2 - art.x - art.width * region.x / region.width)).toBeLessThan(2);
      expect(Math.abs(cursor.y + cursor.height / 2 - art.y - art.height * region.y / region.height)).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: info.outputPath(`${region.name.toLowerCase()}-native-map.png`) });
      await page.getByRole('button', { name: `Travel to ${region.target}`, exact: true }).click();
      await expect(page.getByRole('group', { name: `${region.target} exploration map`, exact: true })).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).catches)).toBe(0);
    });
  }
}
