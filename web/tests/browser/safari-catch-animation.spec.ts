import { test, expect, type Page } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

async function openEncounter(page: Page) {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('catch-animation-seeded')) return;
    sessionStorage.setItem('catch-animation-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    localStorage.setItem('pokesql:ball-theme', JSON.stringify('dusk-ball'));
  }, {
    ...nearSafariGrass(),
    encounter: { id: 'catch-animation', pokemonId: 10, level: 25, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
}

async function submit(page: Page, sql = 'SELECT id, name, type1, type2 FROM pokedex WHERE id=10;') {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
}

for (const width of [1440, 320]) {
  test(`a correct SQL answer throws a themed ball before revealing the Pokédex entry at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openEncounter(page);
    await submit(page, 'SELECT 1;');
    await expect(page.getByText('Not quite.', { exact: false })).toBeVisible();
    await expect(page.locator('.encounter-catch-ball')).toHaveCount(0);
    await submit(page, 'DELETE FROM pokemon;');
    await expect(page.getByRole('alert')).toContainText('one SELECT');
    await expect(page.locator('.encounter-catch-ball')).toHaveCount(0);

    await submit(page);
    const scene = page.locator('.safari-battle-scene');
    const ball = scene.locator('.encounter-catch-ball');
    const entry = page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true });
    await expect(page.locator('.safari-encounter')).toHaveClass(/is-catching/);
    await expect(entry).toHaveCount(0);
    await expect(scene.getByRole('img', { name: 'Already in your Pokédex', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Check query & catch/ })).toHaveCount(0);
    await expect(ball).toHaveAttribute('src', /sprites\/items\/dusk-ball\.png$/);
    await expect(ball).toHaveCSS('opacity', '1');
    const start = (await ball.boundingBox())!;
    const screen = (await scene.boundingBox())!;
    expect(screen.y).toBeGreaterThanOrEqual(0);
    expect(screen.y + screen.height).toBeLessThanOrEqual(1001);
    await expect.poll(async () => (await ball.boundingBox())!.x).toBeGreaterThan(start.x + screen.width * 0.1);
    await scene.screenshot({ path: info.outputPath(`ball-throw-${width}.png`), animations: 'allow' });
    // Sample the impact pose to verify rotation keeps the ball on its target.
    await scene.evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => {
      animation.pause(); animation.currentTime = 1250;
    }));
    const impact = (await ball.boundingBox())!;
    const target = (await scene.locator('.encounter-sprite').boundingBox())!;
    expect(impact.x + impact.width / 2 - target.x - target.width / 2).toBeCloseTo(0, 0);
    await scene.screenshot({ path: info.outputPath(`ball-impact-${width}.png`), animations: 'allow' });
    await scene.evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.play()));
    await expect(scene.locator('.encounter-sprite')).toHaveCSS('opacity', '0');
    await expect.poll(() => ball.evaluate(el => Number(el.getAnimations()[0]?.currentTime ?? 0))).toBeGreaterThan(2400);
    await expect(entry).toHaveCount(0);
    await scene.screenshot({ path: info.outputPath(`ball-shakes-${width}.png`), animations: 'allow' });
    await expect(entry).toContainText('Worm Pokémon');
    await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
    await expect(ball).toHaveCSS('animation-name', 'none');
    const restingBall = (await ball.boundingBox())!;
    const restingPokemon = (await scene.locator('.encounter-sprite').boundingBox())!;
    // All bundled ball icons have 20% transparent padding around their pixels.
    // Their visible base should rest where the Pokémon's feet were standing.
    expect(restingBall.y + restingBall.height * 0.8 - restingPokemon.y - restingPokemon.height).toBeCloseTo(0, 0);
    await expect(scene.getByRole('img', { name: 'Already in your Pokédex', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Caught Pokémon details', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('reloading during the throw preserves one catch and opens the entry without replaying the animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openEncounter(page);
  await submit(page);
  await expect(page.locator('.is-catching .encounter-catch-ball')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.outcome)).toBe('caught');
  await page.reload();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toContainText('Worm Pokémon');
  await expect(page.locator('.encounter-catch-ball')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.is-catching')).toHaveCount(0);
  await expect(page.locator('.safari-pass strong')).toHaveText('01');
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(1);
});

test('reduced motion reveals the entry without waiting for the throw', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEncounter(page);
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-18T12:00:01Z'));
  await submit(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.outcome)).toBe('caught');
  await page.clock.runFor(1);
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toContainText('Worm Pokémon');
  await expect(page.locator('.encounter-catch-ball')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.is-catching')).toHaveCount(0);
});
