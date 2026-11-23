import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { nearSafariGrass, openSafariQuery } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';

test('upgrading an existing download preserves SQL, captures, extra fields and profile highlights', async ({}, info) => {
  test.skip(!process.env.POKESQL_PREVIOUS_EXECUTABLE, 'Set an older packaged executable to test a real version upgrade.');
  test.setTimeout(90000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = (previous = false) => electron.launch({
    executablePath: previous ? process.env.POKESQL_PREVIOUS_EXECUTABLE : process.env.POKESQL_EXECUTABLE,
    args: previous || process.env.POKESQL_EXECUTABLE ? [] : ['.'], env,
  });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(true); let page = await app.firstWindow();
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    const previousVersion = await app.evaluate(({ app }) => app.getVersion());
    await page.locator('.cm-content').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Create real rewards in the old binary. Injecting a legacy journal after
    // its one-time migration cannot create PC ownership in that binary.
    for (const pokemonId of [10, 13]) {
      await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
        ...nearSafariGrass(), encounter: { id: `upgrade-${pokemonId}`, pokemonId, level: 24,
          assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
      });
      await page.reload();
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await openSafariQuery(page);
      await page.locator('.cm-content').fill(`SELECT id, name, type1, type2 FROM pokedex WHERE id = ${pokemonId};`);
      await page.getByRole('button', { name: /Check query & catch|Catch Pokémon/ }).click();
      await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
    await page.locator('.cm-content').fill("UPDATE pokemon SET name = 'Upgrade checkpoint' WHERE id = 1; SELECT name FROM pokemon WHERE id = 1;");
    await page.locator('.cm-content').press('ControlOrMeta+Enter');
    await expect(page.getByRole('cell', { name: 'Upgrade checkpoint', exact: true })).toBeVisible();
    await page.locator('.cm-content').fill('DROP TABLE pokemon;');
    await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Slot 1: Caterpie/ })).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('pokesql-collection-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['captures', 'metadata'], 'readwrite');
        const captures = tx.objectStore('captures'), metadata = tx.objectStore('metadata');
        const all = captures.getAll();
        all.onsuccess = () => {
          const first = all.result[0]; captures.put({ ...first, nickname: 'Starter', futureField: { preserved: true } });
          const state = metadata.get('state'); state.onsuccess = () => metadata.put({ ...state.result, featuredIds: [first.id] }, 'state');
        };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      };
    }));
    const before = await collectionSnapshot(page);
    await app.close(); app = await launch(); page = await app.firstWindow();
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    const currentVersion = await app.evaluate(({ app }) => app.getVersion());
    expect(currentVersion).toBe('0.2.6'); expect(currentVersion).not.toBe(previousVersion);
    await expect(page.locator('.cm-content')).toHaveText('DROP TABLE pokemon;');
    await page.locator('.cm-content').fill('SELECT name FROM pokemon WHERE id = 1;');
    await page.locator('.cm-content').press('ControlOrMeta+Enter');
    await expect(page.getByRole('cell', { name: 'Upgrade checkpoint', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'PC Boxes', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Slot 1: Starter/ })).toBeVisible();
    const after = await collectionSnapshot(page);
    expect(after.captures).toEqual(before.captures); expect(after.featuredIds).toEqual(before.featuredIds);
    await page.getByRole('button', { name: 'My Pokédex', exact: true }).click();
    await page.getByLabel('Status', { exact: true }).selectOption('owned');
    await expect(page.locator('.pokedex-slot.is-owned')).toHaveCount(2);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByText('PokéSQL 0.2.6', { exact: true })).toBeVisible();
    await writeFile(info.outputPath('upgrade-state.json'), JSON.stringify({ captures: after.captures.length, featured: after.featuredIds, previousVersion, currentVersion }, null, 2));
  } finally { await app?.close(); }
});
