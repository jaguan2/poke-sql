import { test, expect, type Page } from '@playwright/test';
import { entriesFor } from '../fixtures/pokemon-encounters';
import { collectionSnapshot } from '../fixtures/pc';
import { createCollection, deposit } from '../../src/features/pc/model';

async function oldCollection(ids = [1, 4, 7, 10, 25, 133, 131]) {
  const entries = await entriesFor(ids);
  const current = deposit(createCollection(), entries.map((entry, i) => ({ id: `owned:${i}`, pokemon: entry.pokemon, source: 'safari' as const, sources: ['safari' as const],
    level: 14 + i % 37, shiny: i === 0, ball: 'poke-ball', caughtAt: entry.firstFoundAt, firstRecordedAt: entry.firstFoundAt, location: 'Route 1', attempts: 1, sql: 'SELECT * FROM pokedex' })));
  const { schemaVersion: _version, partyIds: _party, ...old } = current;
  return { ...old, migrated: true, featuredIds: ['owned:6'].filter(id => old.captures.some(c => c.id === id)),
    customMetadata: { preserve: 'original' }, captures: old.captures.map(capture => ({ ...capture, unknownCaptureField: { keep: [1, 2, 3] } })) };
}
async function seed(page: Page, value: Awaited<ReturnType<typeof oldCollection>>) {
  await page.goto('/'); await openPC(page);
  await page.evaluate(collection => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('pokesql-collection-v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['captures', 'metadata'], 'readwrite');
      const captures = tx.objectStore('captures'); captures.clear();
      for (const capture of collection.captures) captures.put(capture);
      const { captures: _captures, ...metadata } = collection; tx.objectStore('metadata').put(metadata, 'state');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  }), value);
}
async function openPC(page: Page) {
  await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Box 1 slots', exact: true })).toBeVisible();
}
const selected = (page: Page) => page.getByRole('region', { name: 'Selected Pokémon', exact: true });

for (const viewport of [{ width: 1440, height: 1100 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
  test(`party migration, ordering, box movement and offline restore at ${viewport.width}×${viewport.height}`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport); const old = await oldCollection(); await seed(page, old); await page.reload(); await openPC(page);
    const initial = await collectionSnapshot(page); expect(initial.schemaVersion).toBe(2); expect(initial.partyIds).toEqual([]);
    expect(initial.captures).toEqual(old.captures); expect(initial.migrationBackup?.metadata).toMatchObject({ customMetadata: old.customMetadata });
    for (let slot = 1; slot <= 6; slot++) {
      await page.getByRole('group', { name: 'Box 1 slots', exact: true }).getByRole('button', { name: new RegExp(`^Slot ${slot}:`) }).click();
      await selected(page).getByRole('button', { name: 'Add to party', exact: true }).click();
      await expect(selected(page).getByRole('button', { name: 'Remove from party', exact: true })).toBeEnabled();
    }
    await page.getByRole('button', { name: /^Slot 7:/ }).click(); await expect(selected(page).getByRole('button', { name: 'Add to party', exact: true })).toBeDisabled();
    const party = page.getByRole('region', { name: 'Active party', exact: true });
    await party.locator('summary').click();
    await party.getByRole('listitem', { name: 'Party member 3: Squirtle', exact: true }).getByRole('button', { name: 'Make leader', exact: true }).click();
    await expect(party.getByRole('listitem').first()).toHaveAttribute('aria-label', 'Party member 1: Squirtle');
    await party.getByRole('button', { name: 'Move Eevee earlier in party', exact: true }).click();
    await party.getByRole('listitem', { name: 'Party member 2: Bulbasaur', exact: true }).getByRole('button', { name: 'Remove from party', exact: true }).click();
    await expect(selected(page).getByRole('button', { name: 'Add to party', exact: true })).toBeEnabled();
    await selected(page).getByRole('button', { name: 'Add to party', exact: true }).click();
    await party.getByRole('listitem').first().locator('.pc-party-member').click();
    await selected(page).getByRole('button', { name: 'Move Pokémon', exact: true }).click();
    await page.getByRole('button', { name: 'Next box', exact: true }).click(); await page.getByRole('button', { name: 'Slot 1: Empty', exact: true }).click();
    await expect(selected(page)).toContainText('Box 2');
    const saved = await collectionSnapshot(page);
    expect(saved.partyIds).toEqual(['owned:2', 'owned:1', 'owned:3', 'owned:5', 'owned:4', 'owned:6']);
    expect(saved.featuredIds).toEqual(old.featuredIds); expect(saved.captures).toHaveLength(7);
    await party.screenshot({ path: info.outputPath('active-party.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 30000 });
    await context.setOffline(true); await page.reload(); await openPC(page);
    const restored = await collectionSnapshot(page); expect(restored.partyIds).toEqual(saved.partyIds); expect(restored.captures).toEqual(saved.captures);
    expect(restored.migrationBackup).toEqual(saved.migrationBackup);
  });
}

test('collection filters find favorites, shiny individuals and duplicates without moving them', async ({ page }) => {
  const old = await oldCollection([1, 1, 4]); old.captures[1].favorite = true;
  await seed(page, old); await page.reload(); await openPC(page);
  const results = page.getByRole('region', { name: 'Caught Pokémon search results', exact: true });
  await page.getByRole('combobox', { name: 'Collection filter', exact: true }).selectOption('duplicates'); await expect(results.getByRole('button')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Collection filter', exact: true }).selectOption('shiny'); await expect(results.getByRole('button')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Collection filter', exact: true }).selectOption('favorites'); await expect(results.getByRole('button')).toHaveCount(1);
  await page.getByLabel('Find caught Pokémon', { exact: true }).fill('Charmander'); await expect(results.getByRole('button')).toHaveCount(0);
  expect((await collectionSnapshot(page)).captures).toEqual(old.captures);
});

test('an interrupted migration rolls back and retry preserves the original capture records', async ({ page }) => {
  const old = await oldCollection(); await seed(page, old);
  await page.addInitScript(() => {
    let aborted = false;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      const request = put.call(this, value, key);
      if (!aborted && this.name === 'metadata' && value?.schemaVersion === 2 && value?.migrationBackup) { aborted = true; this.transaction.abort(); }
      return request;
    };
  });
  await page.reload(); await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry PC save', exact: true })).toBeVisible();
  const rolledBack = await collectionSnapshot(page); expect(rolledBack).not.toHaveProperty('schemaVersion'); expect(rolledBack.captures).toEqual(old.captures);
  await page.getByRole('button', { name: 'Retry PC save', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Box 1 slots', exact: true })).toBeVisible();
  expect((await collectionSnapshot(page)).schemaVersion).toBe(2); expect((await collectionSnapshot(page)).captures).toEqual(old.captures);
});

test('stale tabs adding two different members to a five-member party cannot exceed six', async ({ page, context }) => {
  const old = await oldCollection(); await seed(page, old);
  // Deliberately miss cross-tab messages so both clients act on a stale five-member party.
  await context.addInitScript(() => { Object.defineProperty(window, 'BroadcastChannel', { value: undefined }); });
  await page.reload(); await openPC(page);
  for (let slot = 1; slot <= 5; slot++) {
    await page.getByRole('button', { name: new RegExp(`^Slot ${slot}:`) }).click();
    await selected(page).getByRole('button', { name: 'Add to party', exact: true }).click();
    await expect(selected(page).getByRole('button', { name: 'Remove from party', exact: true })).toBeEnabled();
  }
  const second = await context.newPage(); await second.goto('/'); await openPC(second);
  await page.getByRole('button', { name: /^Slot 6:/ }).click(); await second.getByRole('button', { name: /^Slot 7:/ }).click();
  await Promise.all([selected(page).getByRole('button', { name: 'Add to party', exact: true }).click(), selected(second).getByRole('button', { name: 'Add to party', exact: true }).click()]);
  await expect.poll(async () => (await collectionSnapshot(page)).partyIds.length).toBe(6);
  const saved = await collectionSnapshot(page); expect(new Set(saved.partyIds).size).toBe(6); expect(saved.captures).toHaveLength(7);
  await expect.poll(async () => (await Promise.all([page.locator('.notice').allTextContents(), second.locator('.notice').allTextContents()])).flat().join(' ')).toContain('Your active party can contain up to six Pokémon.');
});

test('three thousand owned Pokémon keep bounded search rendering and searchable filters', async ({ page }, info) => {
  test.setTimeout(60000);
  const old = await oldCollection(Array(3000).fill(25)); await seed(page, old);
  const start = Date.now(); await page.reload(); await openPC(page); const opened = Date.now();
  await page.getByRole('combobox', { name: 'Collection filter', exact: true }).selectOption('duplicates');
  const results = page.getByRole('region', { name: 'Caught Pokémon search results', exact: true });
  await expect(results.getByRole('heading', { name: '3000 matching Pokémon', exact: true })).toBeVisible();
  await expect(results.locator('.pc-search-result')).toHaveCount(60); const filtered = Date.now();
  await results.getByRole('button', { name: 'Show more', exact: true }).click(); await expect(results.locator('.pc-search-result')).toHaveCount(120);
  await page.getByRole('combobox', { name: 'Collection filter', exact: true }).selectOption('shiny'); await expect(results.locator('.pc-search-result')).toHaveCount(1);
  expect((await collectionSnapshot(page)).captures).toHaveLength(3000);
  await info.attach('browser-collection-timings.json', { body: JSON.stringify({ count: 3000, reloadAndOpenMs: opened - start, duplicateFilterMs: filtered - opened }), contentType: 'application/json' });
});

test.describe('touch party controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });
  test('a finger can add, reorder and remove party members', async ({ page }) => {
    await seed(page, await oldCollection()); await page.reload(); await openPC(page);
    for (let i = 1; i <= 2; i++) {
      await page.getByRole('button', { name: new RegExp(`^Slot ${i}:`) }).tap();
      await selected(page).getByRole('button', { name: 'Add to party', exact: true }).tap();
      await expect(selected(page).getByRole('button', { name: 'Remove from party', exact: true })).toBeEnabled();
    }
    const party = page.getByRole('region', { name: 'Active party', exact: true }); await party.locator('summary').tap();
    await party.getByRole('button', { name: 'Move Charmander earlier in party', exact: true }).tap();
    await expect(party.getByRole('listitem').first()).toHaveAttribute('aria-label', 'Party member 1: Charmander');
    await party.getByRole('listitem').first().getByRole('button', { name: 'Remove from party', exact: true }).tap();
    await expect(party.getByRole('listitem')).toHaveCount(1); expect((await collectionSnapshot(page)).captures).toHaveLength(7);
  });
});
