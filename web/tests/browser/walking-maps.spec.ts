import { test, expect } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import { createBag } from '../../src/features/safari/bag-model';
import { routePath } from '../fixtures/safari';

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }]) {
  test(`expanded route follows the trainer and restores exploration offline at ${viewport.width}`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const session = { ...createSafariSession('route-202'), bag: { ...createBag(), repelSteps: 250 } };
    await page.addInitScript(session => {
      if (sessionStorage.getItem('walking-map-seeded')) return;
      sessionStorage.setItem('walking-map-seeded', 'yes');
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
    }, session);
    await page.goto('/');
    await page.getByText('Available offline', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    const map = page.getByRole('group', { name: 'Route 202 exploration map', exact: true });
    await map.focus();
    const destination = { x: 22, y: 5 };
    const path = routePath('route-202', session.position, destination);
    expect(path.length).toBeGreaterThan(20);
    for (const [index, direction] of path.entries()) {
      await page.keyboard.press(`Arrow${direction[0].toUpperCase()}${direction.slice(1)}`);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).steps)).toBe(index + 1);
    }
    await expect(page.locator('.safari-terrain')).toHaveJSProperty('naturalHeight', 576);
    const trainer = (await page.locator('.safari-player').boundingBox())!;
    const frame = (await map.boundingBox())!;
    expect(trainer.y).toBeGreaterThanOrEqual(frame.y);
    expect(trainer.y + trainer.height).toBeLessThanOrEqual(frame.y + frame.height);
    await page.screenshot({ path: info.outputPath('route-202-exploration.png') });
    await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(map).toBeVisible();
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
    expect(restored.position).toEqual(destination);
    expect(restored.steps).toBe(path.length);
    expect(restored.encounter).toBeNull();
  });
}
