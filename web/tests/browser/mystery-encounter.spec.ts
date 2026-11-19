import { test, expect, type Page } from '@playwright/test';
import { dailyPokemonForDate } from '../../src/features/mystery/daily';

async function openMystery(page: Page) {
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
}

async function guess(page: Page, id: number) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(`SELECT id FROM pokedex WHERE id = ${id};`);
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
}

test('daily encounter shows its sprite, reveals its name on a correct SQL guess, and resumes offline', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.setFixedTime('2026-11-17T12:00:00Z');
  await page.goto('/');
  await openMystery(page);
  const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
  const target = dailyPokemonForDate('2026-11-17');
  await expect(scene.getByRole('heading', { name: '???', exact: true })).toBeVisible();
  const level = await scene.locator('.encounter-nameplate small').textContent();
  expect(level).toMatch(/^Lv\.(?:[5-9]|[1-4]\d|50)$/);
  await expect(scene.locator('.encounter-nameplate')).not.toContainText('No.');
  const savedLevel = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!).level);
  expect(level).toBe(`Lv.${savedLevel}`);
  await expect(scene.getByRole('img', { name: 'Mystery Pokémon', exact: true })).toBeVisible();
  await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
  await expect(scene.locator('.encounter-caption')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(async () => (await document.fonts.load('16px "PokeSQL Battle"')).map(font => font.status))).toEqual(['loaded']);
  await scene.screenshot({ path: info.outputPath('daily-mystery.png'), animations: 'disabled' });
  await guess(page, target === 5 ? 6 : 5);
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(1);
  await expect(scene.locator('.encounter-caption')).toHaveText('Still a mystery… Follow the clues!');
  await expect(scene.getByRole('heading', { name: '???', exact: true })).toBeVisible();
  await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
  await guess(page, target);
  await expect(page.getByText('Daily challenge completed.', { exact: false })).toBeVisible();
  await expect(scene.getByRole('img', { name: /^Revealed / })).toBeVisible();
  await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
  await expect(scene.locator('.encounter-nameplate small')).toHaveText(level!);
  await expect(scene).toBeInViewport();
  const revealedName = (await scene.locator('h3').textContent())!;
  await expect(scene.locator('.encounter-caption')).toHaveText(`It’s ${revealedName}!`);
  await scene.screenshot({ path: info.outputPath('daily-revealed.png'), animations: 'disabled' });
  await page.screenshot({ path: info.outputPath('daily-workspace.png') });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await openMystery(page);
  await expect(scene.locator('h3')).toHaveText(revealedName);
  await expect(scene.locator('.encounter-nameplate small')).toHaveText(level!);
  await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  expect(await scene.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(img => (img as HTMLImageElement).decode()));
    return images.map(img => (img as HTMLImageElement).naturalWidth > 0);
  })).toEqual([true, true]);
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(scene.getByRole('heading', { name: '???', exact: true })).toBeVisible();
  const randomLevel = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:mystery-round')!).level);
  expect(randomLevel).toBeGreaterThanOrEqual(5);
  expect(randomLevel).toBeLessThanOrEqual(50);
  await expect(scene.locator('.encounter-nameplate small')).toHaveText(`Lv.${randomLevel}`);
  await expect(scene.getByRole('heading', { name: '???', exact: true })).toBeVisible();
  await expect(scene.locator('.encounter-nameplate')).not.toContainText('WILD');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(scene.locator('h3')).toHaveText(revealedName);
});

for (const width of [1440, 620, 390, 320]) {
  test(`mystery battle fits a 3:2 screen and dialogue at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 6, guessCount: 0, attempts: [] })));
    await page.goto('/');
    await openMystery(page);
    await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    const scene = page.locator('.mystery-encounter .encounter-scene');
    const bounds = (await scene.boundingBox())!;
    expect(bounds.width / bounds.height).toBeCloseTo(1.5, 2);
    expect(bounds.width).toBeLessThanOrEqual(720.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(scene.locator('.encounter-sprite img')).toHaveCSS('transition-duration', '0s');
    await guess(page, 6);
    await expect(scene.getByRole('img', { name: 'Revealed Charizard', exact: true })).toBeVisible();
    const textFits = await scene.locator('.encounter-caption').evaluate(element => {
      const box = element.getBoundingClientRect(), range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return text.top >= box.top && text.bottom <= box.bottom && text.left >= box.left && text.right <= box.right;
    });
    expect(textFits).toBe(true);
    expect(await scene.locator('.encounter-caption').evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    await scene.screenshot({ path: info.outputPath(`mystery-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'New Pokémon', exact: true }).click();
    await expect(scene.getByRole('img', { name: 'Mystery Pokémon', exact: true })).toBeVisible();
    await expect(page.locator('.mystery-table tbody tr')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeEnabled();
  });
}

test('an out-of-range saved target starts a usable round instead of crashing the scene', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 1026, guessCount: 0, attempts: [] })));
  await page.goto('/');
  await openMystery(page);
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Mystery Pokémon', exact: true })).toBeVisible();
  await guess(page, 25);
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(1);
});
