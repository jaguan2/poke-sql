import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import { nearSafariGrass } from '../fixtures/safari';

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });

async function walkingClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-20T12:00:00Z') });
  await page.clock.pauseAt('2026-11-20T12:00:01Z');
}

test('quick taps and turns are accepted, and holding into a wall does not move through it', async ({ page }) => {
  await walkingClock(page);
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), createSafariSession('forest'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const player = page.locator('.safari-player');
  await page.keyboard.press('d'); await page.keyboard.press('a'); await page.keyboard.press('w');
  await expect(player).toHaveAttribute('data-x', '10'); await expect(player).toHaveAttribute('data-y', '16');
  await page.keyboard.press('s'); await page.keyboard.down('d');
  await page.clock.runFor(350); await page.keyboard.up('d');
  await expect(player).toHaveAttribute('data-x', '11'); await expect(player).toHaveAttribute('data-y', '17');
});

test('menus and window blur stop held movement until a fresh key press', async ({ page }) => {
  await walkingClock(page);
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), createSafariSession('forest'));
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const player = page.locator('.safari-player');
  await page.keyboard.down('a'); await page.clock.runFor(120);
  await expect(player).toHaveAttribute('data-x', '8');
  await page.locator('.safari-area-picker > summary').click(); await page.clock.runFor(350);
  await expect(player).toHaveAttribute('data-x', '8');
  await page.locator('.safari-area-picker > summary').click(); await page.clock.runFor(350);
  await expect(player).toHaveAttribute('data-x', '8');
  await page.keyboard.up('a'); await page.keyboard.down('d');
  await expect(player).toHaveAttribute('data-x', '9');
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.clock.runFor(350);
  await expect(player).toHaveAttribute('data-x', '9'); await page.keyboard.up('d');
});

test('an encounter stops held walking and leaving battle does not resume a stale key', async ({ page }) => {
  await walkingClock(page);
  await page.addInitScript(session => {
    localStorage.setItem('pokesql:safari', JSON.stringify(session)); Math.random = () => 0;
  }, nearSafariGrass());
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.keyboard.down('a'); await page.clock.runFor(2500);
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run away', exact: true }).click(); await page.clock.runFor(350);
  await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '3');
  await expect(page.locator('.safari-position')).toContainText('1 steps'); await page.keyboard.up('a');
});

test('neighboring art is ready before travel and a held key continues across an area exit', async ({ page }, info) => {
  await walkingClock(page);
  await page.addInitScript(session => {
    localStorage.setItem('pokesql:safari', JSON.stringify(session)); Math.random = () => 1;
    sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
  }, { ...createSafariSession('pallet-town'), position: { x: 12, y: 1 } });
  await page.route('**/safari/kanto/route-1.png', async route => {
    await new Promise(resolve => setTimeout(resolve, 180)); await route.continue();
  });
  const preloaded = page.waitForResponse(response => response.url().endsWith('/safari/kanto/route-1.png'));
  await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await (await preloaded).finished();
  await page.keyboard.down('w'); await page.clock.runFor(120);
  await expect(page.getByRole('group', { name: 'Route 1 exploration map', exact: true })).toBeVisible();
  expect(await page.locator('.safari-route-world').evaluate(node => node.getAnimations().filter(a => a instanceof CSSTransition && a.transitionProperty === 'transform').length)).toBe(0);
  await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalWidth', 384);
  await page.clock.runFor(160); await page.keyboard.up('w');
  await expect(page.locator('.safari-player')).toHaveAttribute('data-y', '38');
  await expect(page.locator('.safari-player')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('held-key-area-crossing.png') });
  await page.locator('.safari-player').screenshot({ path: info.outputPath('trainer-edge.png'), animations: 'disabled' });
});

test.describe('tablet walking', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test('swipe and hold walks continuously, then stops on release and cancellation', async ({ page }, info) => {
    await walkingClock(page);
    await page.addInitScript(session => {
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
      sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
    }, createSafariSession('forest'));
    await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const map = page.locator('.safari-map'); await map.scrollIntoViewIfNeeded();
    const bounds = (await map.boundingBox())!, x = bounds.x + bounds.width * .65, y = bounds.y + bounds.height * .35;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', point = x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: point, y }] });
    await touch('touchStart'); await touch('touchMove', x - 60); await page.clock.runFor(280); await touch('touchEnd');
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
    await page.clock.runFor(350); await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '7');
    await touch('touchStart'); await touch('touchMove', x + 60); await page.clock.runFor(120); await touch('touchCancel');
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '9');
    await page.clock.runFor(350); await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '9');
    await page.screenshot({ path: info.outputPath('tablet-continuous-walking.png') }); await cdp.detach();
  });
});

test('holding a direction starts walking immediately and keeps a steady pace without keyboard repeats', async ({ page }, info) => {
  await walkingClock(page);
  await page.addInitScript(session => {
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
  }, createSafariSession('forest'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const player = page.locator('.safari-player');
  await page.keyboard.down('a');
  await expect(player).toHaveAttribute('data-x', '9');
  await page.clock.runFor(280);
  await page.keyboard.up('a');
  await expect(player).toHaveAttribute('data-x', '7');
  await page.clock.runFor(350);
  await expect(player).toHaveAttribute('data-x', '7');
  await page.screenshot({ path: info.outputPath('steady-walking.png') });
});
