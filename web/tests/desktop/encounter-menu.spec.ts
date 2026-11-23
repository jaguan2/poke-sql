import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { nearSafariGrass } from '../fixtures/safari';
import { createSafariSession } from '../../src/features/safari/model';
import metadata from '../../src/features/safari/route-trainers.json' with { type: 'json' };
import { collectionSnapshot } from '../fixtures/pc';

test('Windows route trainers and the battle command window retain one catch after restart', async ({}, info) => {
  test.setTimeout(60000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await page.addInitScript(() => { Math.random = () => 0; });
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    await page.locator('.cm-content').waitFor();
    const npc = metadata.locations['route-3'][0];
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('route-3'), position: { x: npc.x, y: npc.y },
    });
    await page.reload(); await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.locator('.safari-route-trainer').first()).toBeVisible();
    await page.locator('.safari-route-trainer').first().evaluate(async node => {
      const image = new Image(); image.src = getComputedStyle(node).backgroundImage.slice(5, -2); await image.decode();
    });
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), nearSafariGrass());
    await page.reload(); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Explore', exact: true }).click(); await page.keyboard.press('a');
    const commands = page.locator('.encounter-caption').getByRole('group', { name: 'Encounter commands' });
    await expect(commands).toBeVisible(); await expect(page.locator('.cm-content')).toHaveCount(0);
    await commands.getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText("'Caterpie';");
    await page.locator('.safari-assignment').getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
    const before = await collectionSnapshot(page); expect(before.captures.map(capture => capture.pokemon.name)).toEqual(['Caterpie']);
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
    expect((await collectionSnapshot(page)).captures).toEqual(before.captures);
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    await writeFile(info.outputPath('collection.json'), JSON.stringify(before, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
