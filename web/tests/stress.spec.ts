import { test, expect, type Page } from '@playwright/test';

async function run(page: Page, sql: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  const start = Date.now();
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible({ timeout: 20000 });
  return Date.now() - start;
}

test('maximum statement batch and repeated queries stay usable', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4175/')) external.push(request.url());
  });
  const start = Date.now();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  const readyMs = Date.now() - start;
  const batchMs = await run(page, Array.from({ length: 50 }, (_, i) =>
    `SELECT ${i} AS batch, a.id, a.name FROM pokemon a CROSS JOIN pokemon b;`).join('\n'));
  await expect(page.locator('.status-bar')).toContainText('100,000+ row(s)');
  const renderedCells = await page.locator('td').count();
  const editStart = Date.now();
  await page.getByLabel('Query name').pressSequentially('Stress benchmark', { delay: 0 });
  const editMs = Date.now() - editStart;
  expect(renderedCells).toBe(1500);
  await expect(page.getByRole('button', { name: 'Previous result', exact: true })).toBeDisabled();
  await page.getByLabel('Result set', { exact: true }).selectOption('49');
  await expect(page.locator('tbody tr').first()).toHaveText('491Bulbasaur');
  await expect(page.getByRole('button', { name: 'Next result', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Rows 501' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous result', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Rows 1–500' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('batch-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Result set', { exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('batch-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  const runs: number[] = [];
  for (let i = 0; i < 20; i++) {
    runs.push(await run(page, `SELECT COUNT(*) AS count, ${i} AS iteration FROM pokemon;`));
    await expect(page.locator('tbody tr')).toHaveText(`1025${i}`);
  }
  await run(page, 'SELECT 1;'.repeat(51));
  await expect(page.getByRole('alert')).toContainText('at most 50');
  await run(page, `SELECT '${'x'.repeat(100001)}';`);
  await expect(page.getByRole('alert')).toContainText('100,000 characters');
  await run(page, 'SELECT name, sprite_url FROM pokedex WHERE id = 25;');
  await expect.poll(() => page.locator('img.sprite').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 96)).toBe(true);
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const metrics = { readyMs, batchMs, renderedCells, editMs, repeatedRunMs: runs };
  console.log('STRESS_METRICS', JSON.stringify(metrics));
  await testInfo.attach('metrics', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
});

test('repeated worker cancellation keeps the UI responsive and restores committed data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await run(page, "UPDATE pokemon SET name = 'Committed' WHERE id = 1;");
  for (let i = 0; i < 3; i++) {
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText("BEGIN; UPDATE pokemon SET name = 'Discarded' WHERE id = 1; SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;");
    await page.getByRole('button', { name: /▶ Run/ }).click();
    // A main-thread heartbeat must continue while SQLite occupies its worker.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.getByRole('button', { name: '■ Stop query' }).click();
    await expect(page.getByRole('alert')).toContainText('Query stopped');
    await run(page, 'SELECT name FROM pokemon WHERE id = 1;');
    await expect(page.getByRole('cell', { name: 'Committed', exact: true })).toBeVisible();
  }
  await page.reload();
  await run(page, 'SELECT name FROM pokemon WHERE id = 1;');
  await expect(page.getByRole('cell', { name: 'Committed', exact: true })).toBeVisible();
});

test('database fetch failure shows a recoverable loading error', async ({ page }) => {
  await page.route('**/pokemon.sqlite', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not load PokéSQL' })).toBeVisible();
  await expect(page.getByText('Failed to load database (503).')).toBeVisible();
  await page.unroute('**/pokemon.sqlite');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await run(page, 'SELECT COUNT(*) FROM pokemon;');
  await expect(page.getByRole('cell', { name: '1025', exact: true })).toBeVisible();
});
