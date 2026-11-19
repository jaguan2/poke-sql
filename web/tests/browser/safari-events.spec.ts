import { test, expect, type Page } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

async function prepare(page: Page, date: string, roll = 0.999) {
  await page.clock.setFixedTime(`${date}T12:00:00Z`);
  await page.addInitScript(({ session, roll }) => {
    Math.random = () => roll;
    if (sessionStorage.getItem('events-seeded')) return;
    sessionStorage.setItem('events-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, { session: nearSafariGrass(), roll });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
}

test('the event board and encounter table lead to a Mythical catch that survives the window ending offline', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await prepare(page, '2026-01-02');
  const table = page.getByRole('table', { name: 'Verdant Forest encounter table' });
  await expect(table.getByRole('row', { name: 'Virizion: not yet found', exact: true })).toContainText('1.0%');
  await expect(table.getByRole('row', { name: 'Celebi: not yet found', exact: true })).toContainText('0.25%');
  await page.locator('.safari-events > summary').click();
  await expect(page.getByRole('article', { name: 'Celebi Mythical event', exact: true })).toContainText('Active now');
  const position = await page.locator('.safari-player').getAttribute('data-x');
  await page.keyboard.press('a');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', position!);
  await page.locator('.safari-events').screenshot({ path: info.outputPath('special-events-desktop.png') });
  await page.getByRole('article', { name: 'Celebi Mythical event', exact: true }).getByRole('button', { name: 'Explore Verdant Forest' }).click();
  await expect(page.locator('.safari-events')).not.toHaveAttribute('open', '');
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Wild Celebi', exact: true })).toBeVisible();
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await page.clock.setFixedTime('2026-01-08T12:00:00Z');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Wild Celebi', exact: true })).toBeVisible();
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('SELECT id, name, type1, type2 FROM pokedex WHERE id=251;');
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByRole('article', { name: 'Celebi Pokédex entry', exact: true })).toContainText('Time Travel Pokémon');
  await page.locator('.safari-catch-summary').screenshot({ path: info.outputPath('celebi-registered.png'), animations: 'disabled' });
});

test('outside an event the table marks special species unavailable and walking selects the normal pool', async ({ page }) => {
  await prepare(page, '2026-01-08');
  const table = page.getByRole('table', { name: 'Verdant Forest encounter table' });
  for (const name of ['Virizion', 'Celebi']) {
    await expect(table.getByRole('row', { name: `${name}: not yet found`, exact: true })).toContainText('Event only');
  }
  await page.getByRole('heading', { name: /Safari Zone/ }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('img', { name: 'Wild Pikachu', exact: true })).toBeVisible();
});

test('midnight refreshes displayed odds and the next encounter uses the new UTC event window', async ({ page }) => {
  await prepare(page, '2026-01-04', 0.99);
  const row = page.getByRole('row', { name: 'Virizion: not yet found', exact: true });
  await expect(row).toContainText('1.0%');
  await page.clock.setFixedTime('2026-01-05T00:00:01Z');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row).toContainText('Event only');
  await page.getByRole('heading', { name: /Safari Zone/ }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('img', { name: 'Wild Pikachu', exact: true })).toBeVisible();
});

test('event windows and habitat navigation fit a small phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await prepare(page, '2026-01-02');
  await page.locator('.safari-events > summary').click();
  await expect(page.getByRole('article', { name: 'Virizion Legendary event', exact: true })).toContainText('2026-01-05');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('.safari-events').screenshot({ path: info.outputPath('special-events-mobile.png') });
  await page.getByRole('article', { name: 'Virizion Legendary event', exact: true }).getByRole('button', { name: 'Explore Verdant Forest' }).click();
  await expect(page.getByRole('group', { name: 'Verdant Forest exploration map' })).toBeVisible();
});

test('a caught Legendary rests in both the event panel and encounter table', async ({ page }) => {
  await prepare(page, '2026-01-02', 0.99);
  await page.getByRole('heading', { name: /Safari Zone/ }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('img', { name: 'Wild Virizion', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('SELECT id, name, type1, type2 FROM pokedex WHERE id=640;');
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByRole('article', { name: 'Virizion Pokédex entry', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.getByRole('row', { name: 'Virizion: registered', exact: true })).toContainText('Resting');
  await page.locator('.safari-events > summary').click();
  await expect(page.getByRole('article', { name: 'Virizion Legendary event', exact: true })).toContainText('Resting after your last catch');
  await expect(page.getByRole('article', { name: 'Celebi Mythical event', exact: true })).toContainText('0.25%');
});
