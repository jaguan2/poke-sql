import { test, expect } from '@playwright/test';
import { nearSafariGrass } from '../fixtures/safari';

for (const width of [1440, 1024, 620, 390, 320]) {
  test(`the encounter and catch retain a 3:2 game screen with usable SQL at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1200 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(session => {
      Math.random = () => 0;
      localStorage.setItem('pokesql:safari', JSON.stringify(session));
    }, nearSafariGrass());
    await page.goto('/');
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await page.getByRole('button', { name: 'Move left', exact: true }).click();
    const scene = page.locator('.safari-battle-scene');
    await expect(scene).toBeVisible();
    async function expectGameScreen() {
      const bounds = (await scene.boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(1.5, 2);
      expect(bounds.width).toBeLessThanOrEqual(720.5);
      if (width === 1440) expect(bounds.width).toBeCloseTo(720, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await expectGameScreen(); // Entrance uses the same geometry as the finished battle.
    await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
    const level = await scene.locator('.encounter-nameplate small').textContent();
    expect(level).toMatch(/^Lv\.(?:[5-9]|[1-4]\d|50)$/);
    await expect(scene.locator('.encounter-nameplate')).not.toContainText('No.');
    await expectGameScreen();
    const caption = (await page.locator('.encounter-caption').boundingBox())!;
    for (const selector of ['.encounter-nameplate', '.encounter-sprite', '.encounter-trainer']) {
      const sprite = (await page.locator(selector).boundingBox())!;
      const bounds = (await scene.boundingBox())!;
      expect(sprite.x).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(sprite.x + sprite.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(sprite.y).toBeGreaterThanOrEqual(bounds.y - 1);
      expect(sprite.y + sprite.height).toBeLessThanOrEqual(caption.y + 1);
    }
    await scene.screenshot({ path: info.outputPath(`battle-${width}.png`), animations: 'disabled' });
    async function submit(sql: string) {
      await page.locator('.cm-content').focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(sql);
      await page.getByRole('button', { name: /Check query & catch/ }).click();
    }
    await submit('SELECT 1;');
    await expect(page.getByText('Not quite.', { exact: false })).toBeVisible();
    await expectGameScreen();
    await submit("SELECT id, name, type1, type2 FROM pokedex WHERE name='Caterpie';");
    await expect(page.getByText('Gotcha! Caterpie was caught!', { exact: true })).toBeVisible();
    await expect(scene.locator('.encounter-nameplate small')).toHaveText(level!);
    await expectGameScreen();
    await expect(page.locator('.safari-catch-summary')).toContainText('Completed in 2 queries.');
    await scene.screenshot({ path: info.outputPath(`catch-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Verdant Forest collection progress' })).toHaveAttribute('value', '1');
  });
}

test('long encounter and catch messages stay inside the dialogue box on a small phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
    ...nearSafariGrass('desert'),
    encounter: { id: 'long-name', pokemonId: 449, assignmentId: 'field-notes', attempts: 0, outcome: "active", fleeAfter: null },
    draft: 'SELECT id, name, type1, type2 FROM pokedex WHERE id=449;',
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  async function expectReadableMessage() {
    const placement = await page.locator('.encounter-caption').evaluate(element => {
      const panel = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return { top: text.top - panel.top, bottom: panel.bottom - text.bottom };
    });
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.bottom).toBeGreaterThanOrEqual(0);
  }
  await expect(page.getByText('A wild Hippopotas appeared!', { exact: true })).toBeVisible();
  await expectReadableMessage();
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByText('Gotcha! Hippopotas was caught!', { exact: true })).toBeVisible();
  await expectReadableMessage();
  await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath('long-message-phone.png'), animations: 'disabled' });
});

for (const [zone, id, name, terrain] of [
  ['forest', 10, 'Caterpie', 'grass'], ['ridge', 95, 'Onix', 'grass'],
  ['desert', 449, 'Hippopotas', 'sand'], ['coast', 131, 'Lapras', 'water'],
  ['cave', 524, 'Roggenrola', 'cave'], ['tundra', 872, 'Snom', 'cave'],
] as const) {
  test(`${name}'s visible pixels sit on the ${terrain} platform at their natural proportions`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.addInitScript(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...nearSafariGrass(zone),
      encounter: { id: 'sprite-grounding', pokemonId: id, assignmentId: 'field-notes', attempts: 0, outcome: "active", fleeAfter: null },
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await expect(page.getByRole('img', { name: `Wild ${name}`, exact: true })).toBeVisible();
    await expect(page.locator('.encounter-background')).toHaveAttribute('src', new RegExp(`/battle/${terrain}\\.png$`));
    expect(await page.evaluate(async () => (await document.fonts.load('16px "PokeSQL Battle"')).map(font => font.status))).toEqual(['loaded']);
    const placement = await page.locator('.encounter-sprite img').evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3]) {
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
        }
      }
      const frame = img.parentElement!.getBoundingClientRect(), image = img.getBoundingClientRect();
      const scene = img.closest('.safari-battle-scene')!.getBoundingClientRect();
      const scaleX = image.width / canvas.width, scaleY = image.height / canvas.height;
      return { scaleX, scaleY, width: right - left, height: bottom - top,
        visibleBottom: (image.y + bottom * scaleY - scene.y) / scene.height,
        visibleLeft: image.x + left * scaleX - frame.x,
        visibleTop: image.y + top * scaleY - frame.y,
        frameWidth: frame.width / scene.width * 240, frameHeight: frame.height / scene.height * 160 };
    });
    expect(placement.scaleX).toBeCloseTo(placement.scaleY, 2);
    expect(placement.visibleBottom).toBeCloseTo(0.45, 3);
    expect(placement.visibleLeft).toBeCloseTo(0, 1);
    expect(placement.visibleTop).toBeCloseTo(0, 1);
    const scale = Math.min(1, 64 / placement.width, 64 / placement.height);
    expect(placement.frameWidth).toBeCloseTo(placement.width * scale, 1);
    expect(placement.frameHeight).toBeCloseTo(placement.height * scale, 1);
    if (id === 10) expect([placement.frameWidth, placement.frameHeight].map(Math.round)).toEqual([31, 35]);
    await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath(`${name.toLowerCase()}-encounter.png`), animations: 'disabled' });
  });
}

test('native encounter scenery, Red and bitmap lettering remain available after an offline reload', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.addInitScript(session => {
    Math.random = () => 0;
    if (sessionStorage.getItem('native-seeded')) return;
    sessionStorage.setItem('native-seeded', 'yes');
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
  }, nearSafariGrass());
  await page.goto('/');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.safari-map').screenshot({ path: info.outputPath('red-on-route.png'), animations: 'disabled' });
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  const level = await page.locator('.encounter-nameplate small').textContent();
  const storedLevel = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.level);
  expect(level).toBe(`Lv.${storedLevel}`);
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByText('A wild Caterpie appeared!', { exact: true })).toBeVisible();
  await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
  expect(await page.evaluate(async () => (await document.fonts.load('16px "PokeSQL Battle"')).map(font => font.status))).toEqual(['loaded']);
  const dimensions = await page.evaluate(async () => Promise.all(['grass.png', 'dialogue.png', 'nameplate.png', '../trainer-battle.png', '../trainer-walking.png'].map(async file => {
    const img = new Image(); img.src = `safari/battle/${file}`; await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  })));
  expect(dimensions).toEqual([[240, 160], [240, 48], [112, 32], [64, 320], [144, 32]]);
  await page.locator('.safari-battle-scene').screenshot({ path: info.outputPath('offline-encounter.png'), animations: 'disabled' });
});
