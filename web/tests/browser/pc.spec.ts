import { test, expect, type Page } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { nearSafariGrass } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';
import { dailyPokemonForDate } from '../../src/features/mystery/daily';

const catchSql = "SELECT id, name, type1, type2 FROM pokedex WHERE name = 'Caterpie';";
const session = (id: string) => ({ ...nearSafariGrass(), encounter: {
  id, pokemonId: 10, level: 14, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8,
} });
async function pc(page: Page) {
  await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Box 1 slots', exact: true })).toBeVisible();
}
async function catchPokemon(page: Page) {
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.cm-content').fill(catchSql);
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toBeVisible();
}

test('correct SQL catches deposit individuals once, while wrong queries award nothing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => {
    if (sessionStorage.getItem('pc-seeded')) return;
    sessionStorage.setItem('pc-seeded', 'yes'); localStorage.setItem('pokesql:safari', JSON.stringify(value));
  }, session('pc-first'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await page.locator('.cm-content').fill("SELECT name FROM pokedex WHERE name = 'Caterpie';");
  await page.getByRole('button', { name: /Check query & catch/ }).click();
  await expect(page.getByText('7 chances remaining', { exact: true })).toBeVisible();
  await pc(page);
  await expect(page.getByRole('button', { name: 'Slot 1: Empty', exact: true })).toBeVisible();
  await catchPokemon(page);
  await page.getByRole('button', { name: 'Open PC Boxes', exact: true }).click();
  await page.getByRole('button', { name: 'Slot 1: Caterpie, level 14', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Selected Pokémon', exact: true });
  await expect(summary).toContainText('Verdant Forest');
  await expect(summary).toContainText('Attempts2');
  await expect(summary.locator('img[alt="poke ball"]')).toBeVisible();
  // Simulates a reload between the PC commit and the older Safari session save.
  await page.evaluate(value => localStorage.setItem('pokesql:safari', JSON.stringify(value)), session('pc-first'));
  await page.reload();
  await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Caterpie Pokédex entry', exact: true })).toBeVisible();
  await pc(page);
  await expect(page.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(1);
  await page.evaluate(value => localStorage.setItem('pokesql:safari', JSON.stringify(value)), session('pc-second'));
  await page.reload();
  await catchPokemon(page);
  await pc(page);
  await expect(page.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Caterpie', exact: true })).toHaveCount(1);
});

test('legacy imports keep their backup, fill thirty slots per box and allow moving, naming and new destinations', async ({ page }) => {
  const entries = await entriesFor(Array.from({ length: 31 }, (_, index) => index + 1));
  await page.addInitScript(value => localStorage.setItem('pokesql:encounters', JSON.stringify(value)), entries);
  await page.goto('/'); await pc(page);
  expect((await collectionSnapshot(page)).legacyBackup?.encounters).toBe(JSON.stringify(entries));
  await expect(page.getByRole('button', { name: /^Slot \d+: (?!Empty)/ })).toHaveCount(30);
  await page.getByRole('button', { name: 'Next box', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Slot 1: Nidoqueen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous box', exact: true }).click();
  await page.getByRole('button', { name: 'Slot 1: Bulbasaur', exact: true }).click();
  await page.getByLabel('Nickname', { exact: true }).fill('Sprout');
  await page.getByRole('button', { name: 'Save nickname', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Slot 1: Sprout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move Pokémon', exact: true }).click();
  await page.getByRole('button', { name: 'Next box', exact: true }).click();
  await page.getByRole('button', { name: 'Slot 1: Nidoqueen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Slot 1: Sprout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send new catches here', exact: true }).click();
  await page.getByLabel('Box name', { exact: true }).fill('Kanto');
  await page.getByRole('button', { name: 'Rename box', exact: true }).click();
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('cave');
  await expect(page.locator('.pc-box')).toHaveAttribute('data-wallpaper', 'cave');
  await page.reload(); await pc(page);
  await expect(page.getByRole('button', { name: 'Slot 1: Nidoqueen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next box', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Kanto slots', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slot 1: Sprout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add box', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Box 65', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Free practice', exact: true }).click();
  await page.locator('.cm-content').fill('DROP TABLE pokemon;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset DB', exact: true }).click();
  await expect(page.getByText('Database restored.', { exact: false })).toBeVisible();
  await pc(page);
  expect((await collectionSnapshot(page)).captures).toHaveLength(31);
  expect((await collectionSnapshot(page)).boxes.find(box => box.id === 2)?.name).toBe('Kanto');
});

test('a Trainer ID features up to six owned Pokémon, reorders them and keeps the lineup offline', async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const entries = await entriesFor([1, 4, 7, 10, 25, 133, 131]);
  await page.addInitScript(value => localStorage.setItem('pokesql:encounters', JSON.stringify(value)), entries);
  await page.goto('/'); await pc(page);
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Pokémon', exact: true }).click();
  const choices = page.getByRole('group', { name: 'Caught Pokémon choices', exact: true });
  for (const name of ['Bulbasaur', 'Charmander', 'Squirtle', 'Caterpie', 'Pikachu', 'Eevee']) {
    const button = choices.getByRole('button', { name: new RegExp(`^${name}`) });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(choices.getByRole('button', { name: /^Lapras/ })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  const lineup = page.getByRole('list', { name: 'Featured Pokémon lineup', exact: true });
  await expect(lineup.locator('strong')).toHaveText(['Bulbasaur', 'Charmander', 'Squirtle', 'Caterpie', 'Pikachu', 'Eevee']);
  await lineup.getByRole('button', { name: 'Move Charmander left', exact: true }).click();
  await expect(lineup.locator('strong')).toHaveText(['Charmander', 'Bulbasaur', 'Squirtle', 'Caterpie', 'Pikachu', 'Eevee']);
  await page.screenshot({ path: info.outputPath('featured-profile.png'), animations: 'disabled' });
  await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
  await page.context().setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Profiles', exact: true }).click();
  await expect(lineup.locator('strong')).toHaveText(['Charmander', 'Bulbasaur', 'Squirtle', 'Caterpie', 'Pikachu', 'Eevee']);
  await lineup.getByRole('button', { name: 'Remove Eevee from profile', exact: true }).click();
  await expect(lineup.locator('strong')).toHaveCount(5);
});

test('distinct random mystery rounds award separate individuals and restored wins never replay SQL', async ({ page }) => {
  const round = { id: 'pc-mystery-a', targetId: 25, level: 17, guessCount: 0, attempts: [] };
  await page.addInitScript(value => {
    if (sessionStorage.getItem('pc-mystery-seeded')) return;
    sessionStorage.setItem('pc-mystery-seeded', 'yes'); localStorage.setItem('pokesql:mystery-round', JSON.stringify(value));
  }, round);
  await page.goto('/');
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await page.locator('.cm-content').fill('SELECT 25 AS id;');
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await expect(page.getByText('Mystery solved', { exact: false })).toBeVisible();
  await pc(page); await expect(page.getByRole('button', { name: 'Slot 1: Pikachu, level 17', exact: true })).toBeVisible();
  await page.evaluate(value => localStorage.setItem('pokesql:mystery-round', JSON.stringify(value)), round);
  await page.reload();
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  await expect(page.locator('.status-bar')).toHaveCount(0);
  await expect(page.locator('.mystery-query-results')).toHaveCount(0);
  await pc(page); await expect(page.getByRole('button', { name: /^Slot \d+: Pikachu/ })).toHaveCount(1);
  await page.evaluate(value => localStorage.setItem('pokesql:mystery-round', JSON.stringify(value)), { ...round, id: 'pc-mystery-b' });
  await page.reload();
  await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
  await page.getByRole('button', { name: 'Random practice', exact: true }).click();
  await page.locator('.cm-content').fill('SELECT 25 AS id;');
  await page.getByRole('button', { name: /Guess Pokémon/ }).click();
  await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  await pc(page); await expect(page.getByRole('button', { name: /^Slot \d+: Pikachu/ })).toHaveCount(2);
});

test('a catch made while PC storage is unavailable is queued, retried and saved with its original metadata', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('pc-retry-seeded')) {
      sessionStorage.setItem('pc-retry-seeded', 'yes'); localStorage.setItem('pokesql:safari', JSON.stringify(value));
    }
    Reflect.set(window, '__pcBlocked', sessionStorage.getItem('pc-save-enabled') !== 'yes');
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(name, version) {
      if (name === 'pokesql-collection-v1' && Reflect.get(window, '__pcBlocked')) throw new DOMException('PC storage blocked', 'SecurityError');
      return version === undefined ? original.call(this, name) : original.call(this, name, version);
    };
  }, session('pc-retry'));
  await page.goto('/'); await catchPokemon(page);
  await expect(page.getByText('1 caught Pokémon is waiting to be saved to PC Boxes.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:pc-pending:safari:pc-retry') ?? 'null').level)).toBe(14);
  await page.reload();
  await expect(page.getByText('1 caught Pokémon is waiting to be saved to PC Boxes.', { exact: false })).toBeVisible();
  await page.evaluate(() => { sessionStorage.setItem('pc-save-enabled', 'yes'); Reflect.set(window, '__pcBlocked', false); });
  await page.getByRole('button', { name: 'Retry PC save', exact: true }).click();
  await pc(page);
  await expect(page.getByRole('button', { name: 'Slot 1: Caterpie, level 14', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).captures.map(capture => [capture.id, capture.ball])).toEqual([['safari:pc-retry', 'poke-ball']]);
  await page.reload(); await pc(page);
  await expect(page.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(1);
});

test('two tabs catching simultaneously receive different slots and share the updated collection', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => localStorage.setItem('pokesql:safari', JSON.stringify(value)), session('tab-left'));
  await page.goto('/');
  const second = await context.newPage(); await second.emulateMedia({ reducedMotion: 'reduce' });
  await second.addInitScript(value => localStorage.setItem('pokesql:safari', JSON.stringify(value)), session('tab-right'));
  await second.goto('/');
  await Promise.all([catchPokemon(page), catchPokemon(second)]);
  await pc(page); await pc(second);
  await expect(page.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(2);
  await expect(second.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(2);
  const saved = await collectionSnapshot(page);
  expect(saved.captures.map(capture => capture.id).sort()).toEqual(['safari:tab-left', 'safari:tab-right']);
  expect(saved.captures.map(capture => capture.slot).sort()).toEqual([0, 1]);
});

test('daily rewards are awarded once per UTC date and survive new daily rounds', async ({ page }) => {
  await page.clock.setFixedTime('2026-01-01T12:00:00Z');
  await page.goto('/');
  for (const date of ['2026-01-01', '2026-01-02']) {
    await page.clock.setFixedTime(`${date}T12:00:00Z`); await page.reload();
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    await page.locator('.cm-content').fill(`SELECT ${dailyPokemonForDate(date)} AS id;`);
    await page.getByRole('button', { name: /Guess Pokémon/ }).click();
    await expect(page.getByRole('button', { name: /Guess Pokémon/ })).toBeDisabled();
  }
  await page.reload(); await pc(page);
  expect((await collectionSnapshot(page)).captures.map(capture => capture.id)).toEqual(['daily:1:2026-01-01', 'daily:1:2026-01-02']);
});

test('unreadable PC metadata stays untouched and does not disable SQL practice', async ({ page }) => {
  await page.goto('/'); await pc(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('pokesql-collection-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('metadata', 'readwrite'); const store = tx.objectStore('metadata');
      const current = store.get('state'); current.onsuccess = () => store.put({ ...current.result, destinationBoxId: 'unreadable' }, 'state');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  await expect(page.getByText('PC data could not be read.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Retry PC save', exact: true }).click();
  expect((await collectionSnapshot(page)).destinationBoxId).toBe('unreadable');
  await page.getByRole('button', { name: 'Free practice', exact: true }).click();
  await page.locator('.cm-content').fill('SELECT name FROM pokemon WHERE id = 1;');
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
});

for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test.describe(`touch PC at ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    test('boxes and profile selection fit and support keyboard and touch', async ({ page }, info) => {
      const entries = await entriesFor([1, 4, 7, 10, 25, 133, 131]);
      await page.addInitScript(value => localStorage.setItem('pokesql:encounters', JSON.stringify(value)), entries);
      await page.goto('/'); await pc(page);
      const positions = await page.locator('.pc-slot').evaluateAll(elements => elements.slice(0, 7).map(element => element.getBoundingClientRect().y));
      expect(positions.slice(0, 6)).toEqual(Array(6).fill(positions[0]));
      expect(positions[6]).toBeGreaterThan(positions[0]);
      const first = page.getByRole('button', { name: 'Slot 1: Bulbasaur', exact: true });
      await first.tap(); expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await first.press('ArrowRight');
      const second = page.getByRole('button', { name: 'Slot 2: Charmander', exact: true });
      await expect(second).toBeFocused(); await second.press('Enter');
      await page.getByRole('button', { name: 'Feature on profile', exact: true }).tap();
      await page.getByRole('button', { name: 'View Trainer ID', exact: true }).tap();
      await expect(page.getByRole('list', { name: 'Featured Pokémon lineup', exact: true }).locator('strong')).toHaveText(['Charmander']);
      await page.getByRole('button', { name: 'Choose Pokémon', exact: true }).tap();
      await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: info.outputPath('tablet-featured-picker.png'), animations: 'disabled' });
    });
  });
}
