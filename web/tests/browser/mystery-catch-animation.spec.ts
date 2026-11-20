import { test, expect, type Page } from '@playwright/test';
import { dailyPokemonForDate } from '../../src/features/mystery/daily';
import { collectionSnapshot } from '../fixtures/pc';

async function open(page: Page, mode: 'daily' | 'random') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  if (mode === 'random') await page.getByRole('button', { name: 'Random practice', exact: true }).click();
}
async function guess(page: Page, sql: string) {
  await page.locator('.cm-content').fill(sql);
  await page.getByRole('button', { name: /Run query/ }).click();
}
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mystery-catch-seeded')) return;
    sessionStorage.setItem('mystery-catch-seeded', 'yes');
    localStorage.setItem('pokesql:mystery-round', JSON.stringify({ id: 'wailord-catch', targetId: 321, level: 36, guessCount: 0, attempts: [] }));
    localStorage.setItem('pokesql:ball-theme', JSON.stringify('master-ball'));
    localStorage.setItem('pokesql:trainer', JSON.stringify('leaf'));
  });
}

for (const { mode, width, height } of [{ mode: 'daily', width: 1440, height: 1050 }, { mode: 'random', width: 820, height: 1180 }, { mode: 'random', width: 1180, height: 820 }] as const) {
  test(`${mode} correct guesses pitch a themed ball and resume without replay or duplicate rewards at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.setFixedTime('2026-11-17T12:00:00Z');
    await seed(page); await open(page, mode);
    const target = mode === 'daily' ? dailyPokemonForDate('2026-11-17') : 321;
    const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
    const wrongGuesses = mode === 'daily' ? 1 : 0;
    if (wrongGuesses) {
      await guess(page, `SELECT id FROM pokedex WHERE id = ${target === 1 ? 2 : 1};`);
      await expect(page.locator('.mystery-table tbody tr')).toHaveCount(1);
      await expect(scene.locator('.encounter-catch-ball')).toHaveCount(0);
    }
    await guess(page, 'SELECT id FROM pokedex LIMIT 2;');
    await expect(page.locator('.mystery-table tbody tr')).toHaveCount(wrongGuesses);
    await expect(scene.locator('.encounter-catch-ball')).toHaveCount(0);
    await guess(page, `SELECT id FROM pokedex WHERE id = ${target};`);
    await expect(scene).toHaveClass(/is-catching/);
    await expect(scene.locator('.encounter-trainer')).toHaveClass(/is-throwing/);
    const ball = scene.locator('.encounter-catch-ball');
    await expect(ball).toHaveAttribute('src', /sprites\/items\/master-ball\.png$/);
    await expect(ball).toHaveCSS('animation-name', 'encounter-catch-throw');
    await expect(ball).toHaveCSS('animation-duration', '3.2s');
    // Sample the real CSS trajectory at fixed frames so a busy renderer cannot
    // turn the first measurement into an already-landed ball.
    const seek = (time: number) => scene.evaluate((element, time) => element.getAnimations({ subtree: true }).forEach(animation => {
      animation.pause(); animation.currentTime = time;
    }), time);
    await seek(450);
    await expect(ball).toHaveCSS('opacity', '1');
    const first = (await ball.boundingBox())!, screen = (await scene.boundingBox())!;
    await seek(850);
    expect((await ball.boundingBox())!.x).toBeGreaterThan(first.x + screen.width * .1);
    await scene.screenshot({ path: info.outputPath(`${mode}-throw.png`), animations: 'allow' });
    await scene.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.play()));
    const captures = (await collectionSnapshot(page)).captures;
    expect(captures).toHaveLength(1);
    expect(captures[0]).toMatchObject({ pokemon: { id: target }, ball: 'master-ball', attempts: wrongGuesses + 1, source: mode });
    await expect(scene.locator('.encounter-sprite')).toHaveCSS('opacity', '0');
    await expect(scene).toHaveClass(/is-caught/);
    await expect(ball).toHaveCSS('animation-name', 'none');
    await expect(scene.locator('.encounter-trainer')).not.toHaveClass(/is-throwing/);
    await expect(scene.locator('.encounter-caption')).toContainText('was caught!');
    if (mode === 'random') await expect(scene.locator('.encounter-caption')).toHaveText('Gotcha! Wailord was caught!');
    await scene.screenshot({ path: info.outputPath(`${mode}-caught.png`), animations: 'disabled' });
    await page.reload(); await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    if (mode === 'random') await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    await expect(scene).toHaveClass(/is-caught/);
    await expect(scene).not.toHaveClass(/is-catching/);
    await expect(ball).toHaveCSS('animation-name', 'none');
    expect((await collectionSnapshot(page)).captures).toHaveLength(1);
  });
}

test('reduced motion settles a new mystery catch immediately and a new round clears the caught scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page); await open(page, 'random');
  await guess(page, 'SELECT id FROM pokedex WHERE id = 321;');
  const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
  await expect(scene).toHaveClass(/is-caught/, { timeout: 1000 });
  await expect(scene.locator('.encounter-catch-ball')).toHaveCSS('animation-name', 'none');
  await expect(scene.locator('.encounter-trainer')).not.toHaveClass(/is-throwing/);
  await page.getByRole('button', { name: 'New Pokémon', exact: true }).click();
  await expect(scene.locator('h3')).toHaveText('???');
  await expect(scene.locator('.encounter-catch-ball')).toHaveCount(0);
  await expect(scene.locator('.encounter-sprite')).toHaveCSS('opacity', '1');
  expect((await collectionSnapshot(page)).captures).toHaveLength(1);
});

test('starting another random round during the throw cancels its visual timer without losing the catch', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page); await open(page, 'random');
  await guess(page, 'SELECT id FROM pokedex WHERE id = 321;');
  const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
  await expect(scene).toHaveClass(/is-catching/);
  await page.getByRole('button', { name: 'New Pokémon', exact: true }).click();
  await expect(scene.locator('h3')).toHaveText('???');
  await page.waitForTimeout(4000);
  await expect(scene).not.toHaveClass(/is-caught|is-catching/);
  await expect(scene.locator('.encounter-catch-ball')).toHaveCount(0);
  expect((await collectionSnapshot(page)).captures).toHaveLength(1);
});
