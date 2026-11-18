import { test, expect, type Page } from '@playwright/test';
import { createSafariSession } from '../../src/features/safari/model';
import type { SafariSession } from '../../src/features/safari/types';
import { entriesFor } from '../fixtures/pokemon-encounters';

async function seed(page: Page, session: SafariSession = { ...createSafariSession(), position: { x: 5, y: 6 } }) {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('safari-seeded')) return;
    localStorage.setItem('pokesql:safari', JSON.stringify(session));
    sessionStorage.setItem('safari-seeded', 'yes');
  }, session);
}
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Safari Zone/ })).toBeVisible();
}
async function encounter(page: Page) {
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(page.locator('.safari-battle-scene')).toBeVisible();
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId as number);
}
async function edit(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await expect(page.locator('.cm-content')).toHaveText(sql, { useInnerText: true });
}
async function check(page: Page, sql: string) {
  await edit(page, sql);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
}

test('walking controls, collisions, biome pools and featured areas work without global keyboard capture', async ({ page }, info) => {
  await seed(page, { ...createSafariSession(), position: { x: 1, y: 1 } });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await open(page);
  const player = page.locator('.safari-player');
  const map = page.getByRole('group', { name: 'Verdant Forest exploration map' });
  await map.focus(); await page.keyboard.press('ArrowLeft');
  await expect(player).toHaveAttribute('data-x', '1');
  await expect(player).toHaveAttribute('data-facing', 'left');
  await page.waitForTimeout(130);
  await page.keyboard.press('d');
  await expect(player).toHaveAttribute('data-x', '2');
  await expect(page.getByRole('complementary', { name: 'Verdant Forest encounter pool' })).toContainText('Caterpie');
  await page.getByRole('button', { name: /Willow Wetlands/ }).click();
  await expect(page.getByRole('group', { name: 'Willow Wetlands exploration map' })).toBeVisible();
  await expect(page.locator('.safari-field-guide')).toContainText('Psyduck');
  await page.getByRole('button', { name: /Amber Ridge/ }).click();
  await expect(page.locator('.safari-field-guide')).toContainText('Larvitar');
  await expect(page.locator('.safari-zones button')).toHaveCount(3);
  await expect(page.locator('.safari-zones button:disabled')).toHaveCount(0);
  await expect(page.locator('.safari-zones')).toContainText('Featured today');
  await page.getByRole('button', { name: /Verdant Forest/ }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dusk Ball', exact: true }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  await page.screenshot({ path: info.outputPath('safari-forest-desktop.png'), animations: 'disabled' });
});

test('rustling grass opens a sliding encounter; only a correct SQL assignment registers the catch', async ({ page }, info) => {
  await seed(page); await page.setViewportSize({ width: 1440, height: 1300 }); await open(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Master Ball', exact: true }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(page.locator('.safari-encounter')).toHaveClass(/is-entering/);
  expect(await page.locator('.safari-wild-sprite').evaluate(el => getComputedStyle(el).animationName)).toBe('safari-slide-wild');
  await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId as number);
  await edit(page, `SELECT id, name, type1, type2\nFROM pokedex\nWHERE id = ${id};`);
  await page.screenshot({ path: info.outputPath('safari-sql-encounter-desktop.png'), animations: 'disabled' });
  await check(page, 'SELECT id, name, type1, type2 FROM pokedex WHERE id=1025;');
  await expect(page.getByText('Not quite.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:encounters')!).length)).toBe(0);
  await check(page, 'DELETE FROM pokemon;');
  await expect(page.getByRole('alert')).toContainText('one SELECT');
  await edit(page, `SELECT id, name, type1, type2\nFROM pokedex\nWHERE id = ${id};`);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByText('Gotcha!', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: info.outputPath('safari-caught-desktop.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.locator('.encounter-sources')).toHaveText('Safari Zone');
  await expect(page.locator('.encounter-card')).toContainText('Best solve: 2 attempts');
  await page.reload();
  await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await expect(page.locator('.encounter-card')).toHaveCount(1);
  await expect(page.locator('.encounter-sources')).toHaveText('Safari Zone');
  await page.getByRole('button', { name: /^Achievements/ }).click();
  await expect(page.getByRole('article', { name: 'Pokédex explorer', exact: true }).getByRole('progressbar')).toHaveAttribute('value', '1');
});

test('Safari survives offline reload without replaying its SQL draft and catches ignore practice database edits', async ({ page, context }) => {
  await seed(page); await page.goto('/');
  await edit(page, "UPDATE pokemon SET name='Practice only' WHERE id=10; DROP VIEW pokedex;");
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('.status-bar')).toContainText('Statement executed');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  const id = await encounter(page);
  await edit(page, 'DROP TABLE pokemon;');
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 25000 });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!));
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.locator('.cm-content')).toHaveText('DROP TABLE pokemon;');
  await expect(page.locator('.safari-encounter')).not.toHaveClass(/is-entering/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter)).toEqual(before.encounter);
  await check(page, `SELECT id, name, type1, type2 FROM pokedex WHERE id=${id};`);
  await expect(page.getByText('Gotcha!', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.locator('.safari-map')).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await edit(page, 'SELECT name FROM pokemon WHERE id=10;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Practice only', exact: true })).toBeVisible();
});

test('stopping a catch query preserves the encounter and exploration controls stay disabled while checking', async ({ page }) => {
  await seed(page); await open(page); const id = await encounter(page);
  await check(page, 'SELECT COUNT(*) FROM pokemon a CROSS JOIN pokemon b CROSS JOIN pokemon c CROSS JOIN pokemon d;');
  await expect(page.getByRole('button', { name: 'Back to workspace', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Safari Zone', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '■ Stop query', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Query stopped');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.attempts)).toBe(0);
  await check(page, `SELECT id, name, type1, type2 FROM pokedex WHERE id=${id};`);
  await expect(page.getByText('Gotcha!', { exact: false })).toBeVisible();
});

test('guide examples fill the active catch draft without grading, while roaming examples open free practice', async ({ page }) => {
  await seed(page); await open(page); const id = await encounter(page);
  const guide = page.getByRole('region', { name: 'SQL guide', exact: true });
  const joins = guide.locator('details').filter({ has: page.getByText('JOIN tables', { exact: true }) });
  await joins.locator('summary').click();
  await joins.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Safari Zone/ })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('JOIN pokemon_types AS pt');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter)).toMatchObject({ pokemonId: id, attempts: 0, caught: false });
  await page.getByRole('button', { name: 'Return to trail', exact: true }).click();
  await joins.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('JOIN pokemon_types AS pt');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('collection recovery keeps valid discoveries and backs up the original save when one row is corrupt', async ({ page }) => {
  const entries = await entriesFor([6, 25]);
  const original = JSON.stringify([entries[0], { ...entries[1], firstFoundAt: 'invalid-date' }]);
  await page.addInitScript(original => {
    if (sessionStorage.getItem('recovery-seeded')) return;
    localStorage.setItem('pokesql:encounters', original);
    sessionStorage.setItem('recovery-seeded', 'yes');
  }, original);
  await page.goto('/'); await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
  await expect(page.getByText('Valid entries were recovered', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokesql:encounters-recovery'))).toBe(original);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:encounters')!).length)).toBe(1);
  await page.reload(); await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
});

test('a blocked recovery backup preserves the original save instead of overwriting it', async ({ page }) => {
  const [entry] = await entriesFor([6]);
  const original = JSON.stringify([entry, null]);
  await page.addInitScript(original => {
    localStorage.setItem('pokesql:encounters', original);
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'pokesql:encounters-recovery') throw new DOMException('Quota', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
  }, original);
  await page.goto('/'); await page.getByRole('button', { name: /^My Pokédex/ }).click();
  await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
  await expect(page.getByText('this device could not save it', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokesql:encounters'))).toBe(original);
});

test.describe('Safari touch input', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch taps and held controls move the trainer and release or blur stops movement', async ({ page }) => {
    await seed(page, createSafariSession()); await open(page);
    const left = page.getByRole('button', { name: 'Move left', exact: true });
    await left.tap();
    await expect(page.locator('.safari-player')).toHaveAttribute('data-x', '6');
    await page.waitForTimeout(130);
    await left.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).position.x)).toBeLessThanOrEqual(4);
    await left.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    const stopped = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).steps);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).steps)).toBe(stopped);
    const right = page.getByRole('button', { name: 'Move right', exact: true });
    await right.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const blurred = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).steps);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).steps)).toBe(blurred);
  });
});

test('mobile Safari controls and SQL catch layout fit without nested page scrolling, including reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  for (const width of [320, 390, 620]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    await page.locator('.safari-dpad').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Move left', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320) {
      await encounter(page);
      await expect(page.locator('.safari-battle-scene')).toBeInViewport();
      expect(await page.locator('.safari-wild-sprite').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      await page.locator('.safari-query-actions').scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeInViewport();
      const nested = await page.locator('.app,.body,.main,.safari-zone,.safari-assignment').evaluateAll(elements => elements.some(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1));
      expect(nested).toBe(false);
      await page.screenshot({ path: info.outputPath('safari-catch-mobile-320.png') });
      await page.getByRole('button', { name: 'Return to trail', exact: true }).click();
    }
    await page.screenshot({ path: info.outputPath(`safari-mobile-${width}.png`), fullPage: true });
  }
});
