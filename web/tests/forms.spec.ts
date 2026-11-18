import { test, expect, type Page } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { entriesFor } from './fixtures/pokemon-encounters';

async function run(page: Page, sql: string) {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await page.getByRole('button', { name: /▶ Run/ }).click();
}

test('expanded form example and challenges work on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Charizard and its Mega forms', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('button', { name: /▶ Run/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').nth(1).locator('td')).toHaveText(['Mega Charizard X', '1', '6', '130', '130', '634']);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('region', { name: 'Query results', exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`charizard-forms-${width}.png`), fullPage: width === 390 });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /Mega Charizard's changing types/ }).click();
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('older saved databases retain edits until explicit reset loads the expanded dataset', async ({ page }) => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  let bytes: number[];
  try {
    // Recreate the original schema without requiring an ignored CSV cache or
    // a second committed binary fixture. Keep real practice edits in the save.
    db.run(`DROP VIEW pokedex; DROP TABLE pokemon_form_types; DROP TABLE pokemon_form_abilities; DROP TABLE pokemon_forms;`);
    for (const column of ['has_mega_evolution', 'mega_form_count', 'has_regional_form', 'evolution_stage', 'can_evolve']) {
      db.run(`ALTER TABLE pokemon DROP COLUMN ${column}`);
    }
    db.run(`CREATE VIEW pokedex AS SELECT p.id,p.name,g.name AS generation,g.region,g.id AS generation_id,
      t1.name AS type1,t2.name AS type2,p.hp,p.attack,p.defense,p.special_attack,p.special_defense,p.speed,
      p.total_stats,p.height_m,p.weight_kg,p.is_legendary,p.is_mythical,pre.name AS evolves_from,p.sprite_url
      FROM pokemon p JOIN generations g ON g.id=p.generation_id
      LEFT JOIN pokemon_types pt1 ON pt1.pokemon_id=p.id AND pt1.slot=1 LEFT JOIN types t1 ON t1.id=pt1.type_id
      LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id=p.id AND pt2.slot=2 LEFT JOIN types t2 ON t2.id=pt2.type_id
      LEFT JOIN pokemon pre ON pre.id=p.evolves_from_id;
      PRAGMA user_version=0; UPDATE pokemon SET name='My Charizard' WHERE id=6;
      CREATE TABLE my_notes (note TEXT); INSERT INTO my_notes VALUES ('keep until reset');`);
    bytes = Array.from(db.export());
  } finally { db.close(); }
  await page.goto('/');
  await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
  const encounters = await entriesFor([6]);
  await page.evaluate(async ({ bytes, encounters }) => {
    localStorage.setItem('pokesql:drafts', JSON.stringify({ sandbox: 'DROP TABLE pokemon;' }));
    localStorage.setItem('pokesql:saved', JSON.stringify([{ id: 'kept', name: 'My query', sql: 'SELECT 42;' }]));
    localStorage.setItem('pokesql:completed', JSON.stringify(['fast-ghosts']));
    localStorage.setItem('pokesql:encounters', JSON.stringify(encounters));
    const open = indexedDB.open('pokesql-workspace-v1', 1);
    await new Promise<void>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const connection = open.result;
        const tx = connection.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put(new Uint8Array(bytes), 'database');
        tx.oncomplete = () => { connection.close(); resolve(); };
        tx.onerror = () => { connection.close(); reject(tx.error); };
      };
    });
  }, { bytes, encounters });
  await page.reload();
  const update = page.locator('.dataset-update');
  await expect(update).toContainText('replaces practice database edits');
  await expect(page.locator('.cm-content')).toContainText('DROP TABLE pokemon;');
  await run(page, 'SELECT name FROM pokemon WHERE id=6;');
  await expect(page.getByRole('cell', { name: 'My Charizard', exact: true })).toBeVisible();
  await run(page, 'SELECT note FROM my_notes;');
  await expect(page.getByRole('cell', { name: 'keep until reset', exact: true })).toBeVisible();
  // New exercises use the original dataset even before an old save is reset.
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await page.getByRole('button', { name: /Kanto's Mega roster/ }).click();
  await page.getByText('Answer', { exact: true }).click();
  await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
  await page.getByRole('button', { name: /Check answer/ }).click();
  await expect(page.getByText('✓ Correct! Challenge completed.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to free practice' }).click();
  const draft = await page.locator('.cm-content').innerText();
  await update.getByRole('button', { name: 'Reset DB and load update' }).click();
  await expect(update).toHaveCount(0);
  await expect(page.locator('.cm-content')).toHaveText(draft);
  await run(page, 'SELECT name, mega_form_count FROM pokedex WHERE id=6;');
  await expect(page.locator('tbody tr').locator('td')).toHaveText(['Charizard', '2']);
  await expect(page.locator('.table-name', { hasText: /^pokemon_forms$/ })).toBeVisible();
  await page.reload();
  await expect(update).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('pokesql:saved')!),
    completed: JSON.parse(localStorage.getItem('pokesql:completed')!),
    encounters: JSON.parse(localStorage.getItem('pokesql:encounters')!).length,
  }))).toEqual({ saved: [{ id: 'kept', name: 'My query', sql: 'SELECT 42;' }], completed: ['fast-ghosts', 'kanto-mega-species'], encounters: 1 });
});
