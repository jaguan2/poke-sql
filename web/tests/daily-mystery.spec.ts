import { test, expect, type Page } from '@playwright/test';
import { dailyPokemonForDate } from '../src/daily-mystery';

async function openDaily(page: Page) {
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Daily challenge', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

async function edit(page: Page, sql: string) {
  await page.locator('.cm-editor').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
}

async function guess(page: Page, id: number) {
  await edit(page, `SELECT id FROM pokedex WHERE id = ${id};`);
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeVisible();
}

test('the same UTC date gets the same puzzle across time zones and independent profiles', async ({ browser }) => {
  for (const timezoneId of ['America/New_York', 'Asia/Tokyo']) {
    const context = await browser.newContext({ timezoneId });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime('2026-11-17T23:30:00Z');
      await page.goto('http://127.0.0.1:4175/');
      await openDaily(page);
      await expect(page.locator('.mystery-date')).toContainText('2026-11-17');
      await expect(page.getByRole('button', { name: 'New Pokémon', exact: true })).toHaveCount(0);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!));
      expect(saved.date).toBe('2026-11-17');
      expect(saved.targetId).toBe(dailyPokemonForDate('2026-11-17'));
      await page.reload();
      await openDaily(page);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!).targetId)).toBe(saved.targetId);
      await expect(page.locator('.mystery-table tbody tr')).toHaveCount(0);
    } finally { await context.close(); }
  }
});

test('daily and random rounds keep independent drafts and progress, including offline reload', async ({ page, context }) => {
  await page.clock.setFixedTime('2026-11-17T12:00:00Z');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('daily-test-seeded')) return;
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 6, guessCount: 0, attempts: [] }));
    sessionStorage.setItem('daily-test-seeded', 'yes');
  });
  await page.goto('/');
  await openDaily(page);
  const target = dailyPokemonForDate('2026-11-17');
  await guess(page, target === 5 ? 6 : 5);
  await edit(page, `SELECT id FROM pokedex WHERE id = ${target};`);
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await guess(page, 5);
  await edit(page, 'SELECT id FROM pokedex WHERE id = 6;');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText(`WHERE id = ${target};`);
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('1 guess');
  await page.locator('.cm-editor').click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('Daily challenge completed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await openDaily(page);
  await expect(page.getByText('Daily challenge completed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('WHERE id = 6;');
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('1 guess');
  await page.locator('.cm-editor').click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('You found Charizard in 2 guesses!', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!).guessCount)).toBe(2);
});

test('midnight does not retarget an in-flight round and opening today resets only daily work', async ({ page }) => {
  await page.clock.setFixedTime('2026-11-17T23:59:50Z');
  await page.goto('/');
  await openDaily(page);
  const target = dailyPokemonForDate('2026-11-17');
  await guess(page, target === 5 ? 6 : 5);
  await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d');
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await page.clock.setFixedTime('2026-11-18T00:00:02Z');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const openToday = page.getByRole('button', { name: "Open today's challenge", exact: true });
  await expect(openToday).toBeDisabled();
  await expect(page.locator('.mystery-date')).toContainText('2026-11-17');
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Query stopped');
  const oldRound = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!));
  expect(oldRound).toMatchObject({ date: '2026-11-17', targetId: target, guessCount: 1 });
  await openToday.click();
  await expect(page.locator('.mystery-date')).toContainText('2026-11-18');
  await expect(page.getByRole('region', { name: 'Who’s That Pokémon?', exact: true })).toContainText('0 guesses');
  await expect(page.locator('.mystery-table tbody tr')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toContainText("WHERE name = 'Pikachu'");
  const newRound = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!));
  expect(newRound).toMatchObject({ date: '2026-11-18', targetId: dailyPokemonForDate('2026-11-18'), guessCount: 0 });
  expect(newRound.targetId).not.toBe(oldRound.targetId);
});

test('daily controls and date stay usable at desktop and mobile sizes', async ({ page }, testInfo) => {
  await page.clock.setFixedTime('2026-11-17T12:00:00Z');
  await page.goto('/');
  await openDaily(page);
  const target = dailyPokemonForDate('2026-11-17');
  await guess(page, target === 5 ? 6 : 5);
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const date = page.locator('.mystery-date');
    await date.scrollIntoViewIfNeeded();
    await expect(date).toBeInViewport();
    await page.getByRole('region', { name: 'Pokémon clue comparisons', exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`daily-${viewport.width}.png`), fullPage: true });
  }
});
