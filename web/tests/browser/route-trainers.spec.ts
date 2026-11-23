import { test, expect } from '@playwright/test';
import metadata from '../../src/features/safari/route-trainers.json' with { type: 'json' };
import { createSafariSession } from '../../src/features/safari/model';
import { movePosition, zoneById } from '../../src/features/safari/zones';
import { regionTravel } from '../../src/features/safari/regions';

for (const id of ['route-3', 'route-104', 'route-30'] as const) {
  test(`${id} has native-position trainer scenery without changing walking or offline travel`, async ({ page, context }, info) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    const zone = zoneById(id);
    const npc = metadata.locations[id].find(npc => zone.map[npc.y][npc.x] === '.')!;
    const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
    const approach = (['up', 'down', 'left', 'right'] as const).map(direction => {
      const position = movePosition(zone, npc, direction), back = reverse[direction];
      const destination = movePosition(zone, position, back);
      return { position, back, valid: position !== npc && destination.x === npc.x && destination.y === npc.y && !regionTravel(id, position, back) };
    }).find(point => point.valid)!;
    await page.addInitScript(session => {
      if (!localStorage.getItem('pokesql:safari')) localStorage.setItem('pokesql:safari', JSON.stringify(session));
      sessionStorage.setItem('pokesql:safari-controls-seen', 'yes');
    }, { ...createSafariSession(id), position: approach.position });
    await page.goto('/'); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const decoration = page.locator(`.safari-route-trainer[data-x="${npc.x}"][data-y="${npc.y}"]`);
    await expect(decoration).toBeVisible(); await expect(decoration).toHaveCSS('pointer-events', 'none');
    await decoration.evaluate(async node => {
      const image = new Image(); image.src = getComputedStyle(node).backgroundImage.slice(5, -2); await image.decode();
    });
    await page.locator('.safari-map').scrollIntoViewIfNeeded();
    await page.locator('.safari-map').screenshot({ path: info.outputPath('route-trainers.png') });
    await page.keyboard.press(`Arrow${approach.back[0].toUpperCase()}${approach.back.slice(1)}`);
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', String(npc.x));
    await expect(page.locator('.safari-player')).toHaveAttribute('data-y', String(npc.y));
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
    await context.setOffline(true); await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(decoration).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter)).toBeNull();
  });
}
