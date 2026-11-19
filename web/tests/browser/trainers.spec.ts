import { test, expect, type Page } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

async function safari(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
}

test('trainer choices update walking and mystery scenes, save offline and preserve the expedition', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await safari(page);
  const player = page.locator('.safari-player');
  const walking = player.locator('.trainer-sprite');
  await expect(walking).toHaveAttribute('data-trainer', 'red');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await page.getByRole('radio', { name: 'Boy (Red)', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Girl (Leaf)', exact: true })).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).position.x)).toBe(10);
  await expect(page.locator('.trainer-card .trainer-sprite')).toHaveAttribute('data-trainer', 'leaf');
  await page.screenshot({ path: info.outputPath('trainer-profiles.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(walking).toHaveCSS('background-image', /trainer-girl-walking\.png/);
  await page.keyboard.press('a');
  await expect(player).toHaveAttribute('data-x', '9');
  await page.locator('.safari-map').scrollIntoViewIfNeeded();
  await page.locator('.safari-field').screenshot({ path: info.outputPath('girl-trainer-route.png'), animations: 'disabled' });
  expect(await page.evaluate(() => localStorage.getItem('pokesql:trainer'))).toBe('"leaf"');
  await page.getByRole('button', { name: "Today's mystery", exact: true }).click();
  await expect(page.locator('.encounter-trainer')).toHaveAttribute('data-trainer', 'leaf');
  await expect(page.locator('.encounter-trainer')).toHaveCSS('background-image', /trainer-girl-battle\.png/);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(walking).toHaveAttribute('data-trainer', 'leaf');
  await expect(player).toHaveAttribute('data-x', '9');
  await expect(walking).toHaveCSS('background-image', /trainer-girl-walking\.png/);
  expect(await walking.evaluate(async el => {
    const img = new Image(); img.src = getComputedStyle(el).backgroundImage.slice(5, -2); await img.decode(); return img.naturalWidth;
  })).toBe(144);
  await page.getByRole('button', { name: "Today's mystery", exact: true }).click();
  await expect(page.locator('.encounter-trainer')).toHaveCSS('background-image', /trainer-girl-battle\.png/);
});

test('an invalid saved trainer falls back to Red and blocked saves still apply the choice for the session', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokesql:trainer', '"toString"');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'pokesql:trainer') throw new DOMException('Quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await safari(page);
  await expect(page.locator('.safari-player .trainer-sprite')).toHaveAttribute('data-trainer', 'red');
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Boy (Red)', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Girl (Leaf)', exact: true }).check();
  await expect(page.getByText('This device could not save a profile change.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.safari-player .trainer-sprite')).toHaveAttribute('data-trainer', 'leaf');
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.locator('.safari-player .trainer-sprite')).toHaveAttribute('data-trainer', 'red');
});

const trainerCases = [
  ['red', 1440, 25, 75, 0, 27], ['leaf', 320, 25, 75, 0, 27],
  ['brendan', 1440, 0, 200 / 3, 100, 29], ['may', 320, 0, 200 / 3, 100, 33],
  ['brendan-rs', 1440, 0, 200 / 3, 100, 27], ['may-rs', 320, 0, 200 / 3, 100, 33],
  ['wally', 1440, 0, 200 / 3, 100, 44], ['steven', 1440, 0, 200 / 3, 100, 59],
] as const;
for (const [id, width, windup, release, idle, handY] of trainerCases) {
  test(`${id} winds up and releases the ball from the pitching pose at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(({ id, session }) => {
      localStorage.setItem('pokesql:trainer', JSON.stringify(id));
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
    }, { id, session: {
      ...nearSafariGrass(),
      encounter: { id: 'trainer-pitch', pokemonId: 10, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: null },
      draft: 'SELECT id, name, type1, type2 FROM pokedex WHERE id=10;',
    } });
    await safari(page);
    await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-18T12:00:01Z'));
    await page.getByRole('button', { name: /Check query & catch/ }).click();
    await expect(page.locator('.is-catching')).toBeVisible();
    const scene = page.locator('.safari-battle-scene');
    const trainer = scene.locator('.encounter-trainer');
    const ball = scene.locator('.safari-catch-ball');
    const seek = (time: number) => scene.evaluate((el, time) => el.getAnimations({ subtree: true }).forEach(animation => {
      animation.pause(); animation.currentTime = time;
    }), time);
    await seek(100);
    await expect(trainer).toHaveAttribute('data-trainer', id);
    await expect.poll(() => trainer.evaluate(el => parseFloat(getComputedStyle(el).backgroundPositionY))).toBeCloseTo(windup, 3);
    await expect(ball).toHaveCSS('opacity', '0');
    const pose = (await trainer.boundingBox())!;
    expect(pose.width / pose.height).toBeCloseTo(1, 2); // Full native frame keeps raised hands visible.
    await scene.screenshot({ path: info.outputPath(`${id}-windup.png`), animations: 'allow' });
    await seek(450);
    await expect.poll(() => trainer.evaluate(el => parseFloat(getComputedStyle(el).backgroundPositionY))).toBeCloseTo(release, 3);
    await expect(ball).toHaveCSS('opacity', '1');
    const released = (await ball.boundingBox())!;
    expect(Math.abs(released.x + released.width / 2 - pose.x - pose.width)).toBeLessThan(pose.width * 0.12);
    expect(Math.abs(released.y + released.height / 2 - pose.y - pose.height * handY / 64)).toBeLessThan(pose.height * 0.15);
    await expect(page.locator('.safari-pokedex-entry')).toHaveCount(0);
    await scene.screenshot({ path: info.outputPath(`${id}-pitch.png`), animations: 'allow' });
    await seek(1250);
    await expect.poll(() => trainer.evaluate(el => parseFloat(getComputedStyle(el).backgroundPositionY))).toBeCloseTo(idle, 3);
    await page.clock.runFor(4000);
    await expect(page.locator('.safari-pokedex-entry')).toContainText('Worm Pokémon');
    await expect(trainer).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.safari-pass strong')).toHaveText('01');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
