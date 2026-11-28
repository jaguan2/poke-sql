import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1600, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`original UI artwork loads offline across menus, PC, trainer card and Sinnoh at ${viewport.width}`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('button', { name: 'My Pokédex', exact: true }).locator('img')).toHaveAttribute('src', /game-ui\/pokedex.png$/);
    await expect(page.getByRole('button', { name: 'Settings', exact: true }).locator('img')).toHaveAttribute('src', /game-ui\/options.png$/);
    await page.getByText('Available offline', { exact: true }).waitFor(); await context.setOffline(true); await page.reload();
    await nav.getByRole('button', { name: 'PC Boxes', exact: true }).click();
    for (const kind of ['forest', 'coast', 'cave', 'city']) {
      await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption(kind);
      await expect(page.locator('.pc-box')).toHaveAttribute('data-wallpaper', kind);
      const image = await page.locator('.pc-grid').evaluate(async element => {
        const src = getComputedStyle(element).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)![1];
        const image = new Image(); image.src = src; await image.decode(); return { src, width: image.naturalWidth, height: image.naturalHeight };
      });
      expect(image.src).toContain(`/game-ui/pc-${kind}.png`); expect([image.width, image.height]).toEqual([160, 144]);
    }
    await page.screenshot({ path: info.outputPath('native-pc.png') });
    await page.getByRole('button', { name: 'Profiles', exact: true }).click();
    await expect(page.locator('.trainer-card-badges img')).toHaveCount(8);
    expect(await page.locator('.profiles-page').evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation && animation.animationName === 'focus-arrival').length)).toBe(0);
    await expect.poll(() => page.locator('.trainer-card-badges img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth === 16))).toBe(true);
    expect(await page.locator('.trainer-card').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('game-ui/trainer-card.png');
    await page.screenshot({ path: info.outputPath('native-trainer-card.png') });
    await nav.getByRole('button', { name: 'Explore', exact: true }).click(); await page.locator('.region-map > summary').click();
    await page.getByRole('button', { name: 'Sinnoh', exact: true }).click();
    await expect(page.locator('.region-map-art')).toHaveAttribute('alt', 'Sinnoh town map from Pokémon Platinum');
    await expect.poll(() => page.locator('.region-map-art').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(512);
    await page.screenshot({ path: info.outputPath('native-sinnoh-map.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
