import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { nearSafariGrass, openSafariQuery } from '../fixtures/safari';
import { collectionSnapshot } from '../fixtures/pc';

test('desktop captures and featured Pokémon persist across a native application restart', async ({}, info) => {
  test.setTimeout(60_000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(value => localStorage.setItem('pokesql:safari', JSON.stringify(value)), {
      ...nearSafariGrass(), encounter: { id: 'desktop-pc', pokemonId: 10, level: 24, assignmentId: 'field-notes', attempts: 0, outcome: 'active', fleeAfter: 8 },
    });
    await page.reload();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await openSafariQuery(page);
    await page.locator('.cm-content').fill('SELECT id, name, type1, type2 FROM pokedex WHERE id = 10;');
    await page.getByRole('button', { name: /Catch Pokémon/ }).click();
    await page.getByRole('button', { name: 'Open PC Boxes', exact: true }).click();
    await page.getByRole('button', { name: 'Slot 1: Caterpie, level 24', exact: true }).click();
    await page.getByRole('button', { name: 'Feature on profile', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove from profile', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Profiles', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Featured Pokémon lineup', exact: true }).locator('strong')).toHaveText(['Caterpie']);
    await page.getByRole('button', { name: 'Open PC Boxes', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Slot \d+: Caterpie/ })).toHaveCount(1);
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    const saved = await collectionSnapshot(page);
    expect(saved.captures.map(capture => [capture.id, capture.level])).toEqual([['safari:desktop-pc', 24]]);
    expect(saved.featuredIds).toEqual(['safari:desktop-pc']);
    await writeFile(info.outputPath('desktop-pc-state.json'), JSON.stringify(saved, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
