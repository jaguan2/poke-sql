import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`Run/Stop keeps the same focused control and cancellation works with motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion }); await page.goto('/');
    await page.locator('.cm-content').fill('SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
    const control = page.locator('.editor-actions .query-action');
    const handle = await control.elementHandle();
    await control.click();
    await expect(control).toHaveAccessibleName('■ Stop query');
    expect(await handle!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true);
    await control.click(); await expect(control).toContainText('Run query');
    expect(await handle!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true);
    await page.locator('.cm-content').fill('SELECT 42 AS result;'); await control.click();
    await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    expect(await handle!.evaluate(node => node.isConnected)).toBe(true);
  });
}

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`Bag stages focus, confirms actions and retains icon layers at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bag', exact: true })).toBeFocused();
    const art = page.locator('.bag-selected-art'); const original = await art.elementHandle();
    const choice = page.getByRole('button', { name: 'Super Repel Unlimited', exact: true });
    await choice.click(); await expect(page.locator('.bag-description h3')).toHaveText('Super Repel');
    await expect(choice).toBeFocused();
    const animations = await choice.evaluate(node => node.getAnimations().map(animation => animation.id));
    expect(animations).toContain('action-confirmation');
    expect(await original!.evaluate(node => node.isConnected)).toBe(true);
    await expect(art.locator('img')).toHaveCount(4);
    await expect(art.locator('img[data-active=true]')).toHaveAttribute('src', /super-repel.png$/);
    await page.locator('.bag-page').getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.bag-effects')).toContainText('200 steps left');
    await expect(page.locator('.bag-page').getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const max = page.getByRole('button', { name: 'Max Repel Unlimited', exact: true }); await max.click();
    expect(await max.evaluate(node => node.getAnimations().filter(animation => animation.id === 'action-confirmation').length)).toBe(0);
    await expect(page.locator('.bag-description h3')).toHaveText('Max Repel');
    await expect(art.locator('img[data-active=true]')).toHaveCSS('filter', 'none');
    await page.screenshot({ path: info.outputPath('bag-interaction.png') });
  });
}

test('help grows in place and remains native, keyboard accessible and usable without motion', async ({ page }, info) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: /Top 10 Pokémon by HP/ }).click();
  const hint = page.locator('.query-help details').first(); const code = await hint.locator('code').elementHandle();
  const closed = (await hint.boundingBox())!.height;
  await hint.locator('summary').focus();
  const [heights] = await Promise.all([
    hint.evaluate(async node => {
      const heights: number[] = [];
      for (let frame = 0; frame < 30; frame++) { heights.push(node.getBoundingClientRect().height); await new Promise(requestAnimationFrame); }
      return heights;
    }), page.keyboard.press('Enter'),
  ]);
  await expect(hint).toHaveAttribute('open', '');
  await expect(hint.locator('code')).toBeVisible();
  if (await page.evaluate(() => CSS.supports('interpolate-size', 'allow-keywords'))) {
    // Observe real intermediate sizes; pseudo-element transitions are not exposed
    // consistently by Element.getAnimations across browser versions.
    expect(new Set(heights.map(height => Math.round(height))).size).toBeGreaterThan(2);
  }
  expect((await hint.boundingBox())!.height).toBeGreaterThan(closed + 30);
  expect(await code!.evaluate(node => node.isConnected)).toBe(true);
  await page.screenshot({ path: info.outputPath('expanded-hint.png') });
  await page.keyboard.press('Enter'); await expect(hint).not.toHaveAttribute('open', '');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.keyboard.press('Enter');
  await expect(hint.locator('code')).toBeVisible();
  expect(await hint.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test('menu arrows crossfade inside one icon and focus restoration still works', async ({ page }) => {
  await page.goto('/'); const toggle = page.locator('.menu-button'); const handle = await toggle.elementHandle();
  await toggle.click(); await expect(toggle).toHaveAccessibleName('Show menu');
  await expect(toggle.locator('g.motion-icon')).toHaveCount(2); await expect(toggle.locator('g[data-active=true] path')).toHaveAttribute('d', 'm13 9 3 3-3 3');
  expect(await handle!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true);
  await toggle.click(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bag', exact: true }).click();
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(page.locator('.profiles-page h2')).toBeFocused(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Profiles', exact: true })).toBeFocused();
});
