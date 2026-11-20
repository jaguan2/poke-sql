import { test, expect, type Page } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });

async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await expect(page.locator('.cm-content')).toHaveText(sql);
}

async function expectPageScroll(page: Page) {
  const nested = await page.locator('.app, .body, .sidebar, .main, .practice-panel, .results, .table-scroll, .mystery-table-scroll').evaluateAll(elements =>
    elements.filter(element => /auto|scroll/.test(getComputedStyle(element).overflowY)
      && element.scrollHeight > element.clientHeight + 1).map(element => element.className));
  expect(nested).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const width of [320, 390, 620]) {
  test(`mobile clues fit without nested scrollbars at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime('2026-01-01T12:00:00Z');
    await page.goto('/');
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    for (const [index, name] of ['Pikachu', 'Ampharos', 'Jolteon'].entries()) {
      await edit(page, `SELECT * FROM pokedex WHERE name = '${name}';`);
      await page.getByRole('button', { name: /Run query/ }).click();
      await expect(page.locator('.mystery-table tbody tr')).toHaveCount(index + 1);
    }
    const latest = page.locator('.mystery-table tbody tr').first();
    await latest.scrollIntoViewIfNeeded();
    for (const label of ['Type 1', 'Type 2', 'Generation', 'Height', 'Weight']) {
      await expect(latest.locator('.clue-label').filter({ hasText: new RegExp(`^${label}$`) })).toBeInViewport();
    }
    expect(await latest.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await latest.getByText('SQL used', { exact: true }).click();
    await expect(latest.locator('pre')).toContainText("name = 'Jolteon'");
    await expectPageScroll(page);
    await expect(page.getByRole('button', { name: /Run query/ })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`mobile-notebook-${width}.png`) });

    // Run and Stop remain reachable after scrolling to the notebook.
    await edit(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
    await page.getByRole('button', { name: /Run query/ }).click();
    await expect(page.getByRole('button', { name: '■ Stop query', exact: true })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Query stopped');
    await expect(page.locator('.mystery-table tbody tr')).toHaveCount(3);
  });
}

test('mobile navigation opens pages and preserves challenge drafts across the desktop breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Challenges', exact: true })).toBeFocused();
  await expectPageScroll(page);
  await page.getByRole('button', { name: /First partners/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await edit(page, "SELECT name, type1 FROM pokedex WHERE name IN ('Bulbasaur', 'Charmander', 'Squirtle');");
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await page.getByRole('button', { name: '▶ SELECT * FROM pokedex', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('LIMIT 25');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Challenge schema', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('LIMIT 25');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expectPageScroll(page);
});

test('wide SQL results scroll horizontally and grow with the page vertically', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await edit(page, 'SELECT * FROM pokedex LIMIT 50;');
  await page.getByRole('button', { name: /Run query/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  const table = page.getByRole('region', { name: 'Query results', exact: true });
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await table.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await expectPageScroll(page);
  await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  expect(await table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.locator('tbody tr').last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Run query/ })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('mobile-results.png') });
});
