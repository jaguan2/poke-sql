import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';
import { zoneById, type ZoneId } from '../../src/features/safari/zones';

test('all nine habitats use local game-tile maps and remain available offline', async ({ page, context }, info) => {
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  for (const [id, name, species] of [
    ['forest', 'Verdant Forest', 'Caterpie'], ['wetlands', 'Willow Wetlands', 'Wooper'],
    ['ridge', 'Amber Ridge', 'Larvitar'], ['meadow', 'Sunlit Meadow', 'Wooloo'],
    ['coast', 'Azure Coast', 'Lapras'], ['desert', 'Mirage Dunes', 'Gible'],
    ['cave', 'Moonstone Caverns', 'Deino'], ['tundra', 'Frostveil Tundra', 'Snom'],
    ['volcano', 'Ember Foothills', 'Torkoal'],
  ]) {
    await page.locator('.safari-area-picker > summary').click();
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('group', { name: `${name} exploration map` })).toBeVisible();
    await expect(page.locator('img.safari-terrain')).toHaveAttribute('src', new RegExp(`safari/maps/${id}\.png$`));
    const zone = zoneById(id as ZoneId);
    await expect.poll(() => page.locator('img.safari-terrain').evaluate((img: HTMLImageElement) => [img.complete, img.naturalWidth, img.naturalHeight])).toEqual([true, zone.map[0].length * 16, zone.map.length * 16]);
    await expect(page.getByRole('complementary', { name: `${name} encounter pool` })).toContainText(species);
    await page.screenshot({ path: info.outputPath(`${id}.png`), animations: 'disabled' });
  }
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Ember Foothills exploration map' })).toBeVisible();
});

test('a tundra SQL catch persists its new habitat, species, and progress', async ({ page }) => {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('tundra-seeded')) return;
    sessionStorage.setItem('tundra-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, nearSafariGrass('tundra'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId);
  await expect(page.locator('.encounter-trainer')).toHaveCSS('background-image', /trainer-battle\.png/);
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(`SELECT id, name, type1, type2 FROM pokedex WHERE id=${id};`);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByText('Gotcha!', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Frostveil Tundra collection progress' })).toHaveAttribute('value', '1');
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Frostveil Tundra collection progress' })).toHaveAttribute('value', '1');
  await expect(page.locator('.safari-player')).toBeVisible();
});

test('the habitat picker fits mobile screens and keeps the selected game map reachable', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.safari-area-picker > summary').click();
  await page.getByRole('button', { name: /Mirage Dunes/ }).click();
  await expect(page.locator('.safari-area-picker')).not.toHaveAttribute('open', '');
  await page.locator('.safari-map').scrollIntoViewIfNeeded();
  await expect(page.locator('img.safari-terrain')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('desert-mobile.png'), animations: 'disabled' });
});
