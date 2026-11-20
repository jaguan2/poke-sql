import { test, expect } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { createSafariSession } from '../../src/features/safari/model';

test('Profiles shows real progress, saves a name and model offline, and retains existing trainer choices', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const entries = await entriesFor([6, 10, 25]);
  await page.addInitScript(({ entries, session }) => {
    if (sessionStorage.getItem('profiles-seeded')) return;
    sessionStorage.setItem('profiles-seeded', 'yes');
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    localStorage.setItem('pokesql:trainer', '"leaf"');
    localStorage.setItem('pokesql:trainer-id', JSON.stringify({ id: '14463', issuedAt: '2012-04-22T12:00:00.000Z' }));
    localStorage.setItem('pokesql:completed', '["first-partners","obsolete-exercise"]');
  }, { entries, session: { ...createSafariSession('forest'), catches: 5 } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trainer ID', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Girl (Leaf)', exact: true })).toBeChecked();
  await expect(page.locator('.trainer-card-number')).toHaveText('ID No. 14463');
  await expect(page.locator('.trainer-card-issued time')).toHaveText('Apr 22, 2012');
  await expect(page.locator('.trainer-card-badges li[data-earned=true]')).toHaveCount(1);
  const counters = page.locator('.profile-statistics');
  await expect(counters.locator('dd')).toHaveText(['3 / 1025', '5', '1 / 15', '4 / 18']);
  await expect(page.getByRole('progressbar', { name: 'Pokédex collection progress' })).toHaveAttribute('value', '3');
  await page.getByLabel('Trainer name', { exact: true }).fill('Jason');
  await expect(page.getByRole('article', { name: 'Your trainer card' }).getByRole('heading', { name: 'Jason', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Girl styles', exact: true }).click();
  await expect(page.locator('.trainer-options input')).toHaveCount(3);
  await page.getByRole('radio', { name: 'May (Emerald)', exact: true }).check();
  await page.getByRole('button', { name: 'Boy styles', exact: true }).click();
  await expect(page.locator('.trainer-options input')).toHaveCount(5);
  await page.getByRole('radio', { name: 'Wally', exact: true }).check();
  await page.getByRole('button', { name: 'All models', exact: true }).click();
  await expect(page.locator('.trainer-options input')).toHaveCount(8);
  await expect(counters.locator('dd').first()).toHaveText('3 / 1025');
  await page.screenshot({ path: info.outputPath('profiles-desktop.png'), animations: 'disabled' });
  await page.locator('.trainer-card').screenshot({ path: info.outputPath('trainer-id-card.png'), animations: 'disabled' });
  await page.locator('.model-section').screenshot({ path: info.outputPath('trainer-models.png'), animations: 'disabled' });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByLabel('Trainer name', { exact: true })).toHaveValue('Jason');
  await expect(page.getByRole('radio', { name: 'Wally', exact: true })).toBeChecked();
  await expect(page.locator('.trainer-card-number')).toHaveText('ID No. 14463');
  await expect(counters.locator('dd')).toHaveText(['3 / 1025', '5', '1 / 15', '4 / 18']);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('heading', { name: 'Trainer ID', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('profiles-mobile.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.safari-player .trainer-sprite')).toHaveAttribute('data-trainer', 'wally');
  expect(await page.locator('.safari-player .trainer-sprite').evaluate(async el => {
    const img = new Image(); img.src = getComputedStyle(el).backgroundImage.slice(5, -2); await img.decode(); return img.naturalWidth;
  })).toBe(144);
});

test('name validation and blocked profile writes preserve the session without losing the expedition', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokesql:trainer-name', JSON.stringify({ invalid: true }));
    localStorage.setItem('pokesql:trainer-id', JSON.stringify({ id: 'invalid', issuedAt: 'not-a-date' }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByLabel('Trainer name', { exact: true })).toHaveValue('');
  await expect(page.locator('.trainer-card-number strong')).toHaveText(/^\d{5}$/);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'pokesql:trainer-name') throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, key, value);
    };
  });
  await page.getByLabel('Trainer name', { exact: true }).fill('A very long trainer name that exceeds the limit');
  expect((await page.getByLabel('Trainer name', { exact: true }).inputValue()).length).toBe(24);
  await expect(page.getByText('This device could not save a profile change.', { exact: false })).toBeVisible();
  await page.getByLabel('Trainer name', { exact: true }).fill('Soobin');
  await expect(page.getByRole('article', { name: 'Your trainer card' })).toContainText('Soobin');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByLabel('Trainer name', { exact: true })).toHaveValue('Soobin');
});

test('icon shortcuts switch between Trainer ID and settings and return to the expedition', async ({ page }, info) => {
  await page.goto('/');
  const profile = page.getByRole('button', { name: 'Profiles', exact: true });
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(profile).toHaveText('');
  await expect(settings).toHaveText('');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await profile.click();
  await expect(page.getByRole('heading', { name: 'Trainer ID', exact: true })).toBeFocused();
  await expect(page.getByRole('switch', { name: 'SQL autocomplete' })).toHaveCount(0);
  const number = await page.locator('.trainer-card-number strong').innerText();
  expect(number).toMatch(/^\d{5}$/);
  await settings.click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  await expect(settings).toHaveAttribute('aria-pressed', 'true');
  await expect(profile).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('radio', { name: 'Dusk Ball', exact: true }).check();
  await page.screenshot({ path: info.outputPath('settings-gear.png'), fullPage: true });
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.cm-content')).toHaveCount(0);
  await profile.click();
  await expect(page.locator('.trainer-card-number strong')).toHaveText(number);
  await settings.click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  // Returning to the trail intentionally restores the map's walking focus.
  await expect(page.locator('.safari-map')).toBeFocused();
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '6');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '8');
  await page.reload();
  await profile.click();
  await expect(page.locator('.trainer-card-number strong')).toHaveText(number);
});
