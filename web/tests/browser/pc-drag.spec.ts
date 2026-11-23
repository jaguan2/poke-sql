import { test, expect } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { collectionSnapshot } from '../fixtures/pc';

test('drag moves, swaps, crosses boxes and persists without changing ownership', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(entries => {
    if (sessionStorage.getItem('drag-seeded')) return;
    sessionStorage.setItem('drag-seeded', 'yes');
    localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
  }, await entriesFor([1, 4]));
  await page.goto('/'); await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  const slot = (number: number) => page.locator(`[data-pc-slot="${number - 1}"]`);
  await expect(slot(1)).toContainText('Bulbasaur');
  await slot(1).dragTo(slot(6));
  await expect(slot(6)).toContainText('Bulbasaur');
  await slot(6).dragTo(slot(2));
  await expect(slot(2)).toContainText('Bulbasaur');
  await expect(slot(6)).toContainText('Charmander');
  const source = (await slot(2).boundingBox())!;
  const next = (await page.getByRole('button', { name: 'Next box', exact: true }).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2, { steps: 12 });
  await expect(page.getByRole('group', { name: 'Box 2 slots', exact: true })).toBeVisible();
  const destination = (await slot(30).boundingBox())!;
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 12 });
  await page.screenshot({ path: info.outputPath('pc-drag-between-boxes.png') });
  await page.mouse.up();
  await expect(slot(30)).toContainText('Bulbasaur');
  const before = (await collectionSnapshot(page)).captures;
  expect(before.map(item => [item.pokemon.name, item.boxId, item.slot]).sort()).toEqual([
    ['Bulbasaur', 2, 29], ['Charmander', 1, 5],
  ]);
  await page.reload(); await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  expect((await collectionSnapshot(page)).captures).toEqual(before);
  const cancelSource = (await slot(6).boundingBox())!, cancelTarget = (await slot(1).boundingBox())!;
  await page.mouse.move(cancelSource.x + cancelSource.width / 2, cancelSource.y + cancelSource.height / 2); await page.mouse.down();
  await page.mouse.move(cancelTarget.x + cancelTarget.width / 2, cancelTarget.y + cancelTarget.height / 2, { steps: 8 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  expect((await collectionSnapshot(page)).captures).toEqual(before);
});

test.describe('iPad dragging', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('a finger can move a Pokémon without scrolling the box or losing the capture', async ({ page, context }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.addInitScript(entries => {
      if (sessionStorage.getItem('touch-drag-seeded')) return;
      sessionStorage.setItem('touch-drag-seeded', 'yes'); localStorage.setItem('pokesql:encounters', JSON.stringify(entries));
    }, await entriesFor([1]));
    await page.goto('/'); await page.getByRole('button', { name: 'Hide menu', exact: true }).tap();
    await page.getByRole('button', { name: 'PC Boxes', exact: true }).tap();
    const source = page.locator('[data-pc-slot="0"]'), destination = page.locator('[data-pc-slot="5"]');
    await expect(source).toContainText('Bulbasaur'); await source.scrollIntoViewIfNeeded();
    const a = (await source.boundingBox())!, b = (await destination.boundingBox())!;
    const input = await context.newCDPSession(page);
    const start = { x: a.x + a.width / 2, y: a.y + a.height / 2, id: 1 };
    const end = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 };
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 8; step++) await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, x: start.x + (end.x - start.x) * step / 8 }] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(destination).toContainText('Bulbasaur');
    expect((await collectionSnapshot(page)).captures.map(item => [item.pokemon.name, item.boxId, item.slot])).toEqual([['Bulbasaur', 1, 5]]);
  });
});
