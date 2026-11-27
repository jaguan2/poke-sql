import { test, expect } from '@playwright/test';
import { openSafariQuery } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';
import { nearSafariGrass } from '../fixtures/safari';

test('Safari catches and opt-in sound cues work offline', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(session => {
    if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
    Math.random = () => 0;
  }, { ...nearSafariGrass(), grassSteps: 5 });
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const sounds = page.getByRole('button', { name: 'Sound effects', exact: true });
  await expect(sounds).toHaveAttribute('aria-pressed', 'false');
  await sounds.click();
  const encounterCue = page.waitForResponse(response => response.url().endsWith('/sounds/encounter.wav'));
  await page.locator('.safari-map').focus();
  await page.keyboard.press('ArrowLeft');
  expect((await encounterCue).ok()).toBe(true);
  await openSafariQuery(page);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId);
  await page.locator('.cm-content').fill(`SELECT * FROM pokedex WHERE id = ${id};`);
  const catchCue = page.waitForResponse(response => response.url().endsWith('/sounds/caught.wav'));
  await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
  expect((await catchCue).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures).toMatchObject([{ pokemon: { id }, location: 'Verdant Forest' }]);
});
