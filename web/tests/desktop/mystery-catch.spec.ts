import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { collectionSnapshot } from '../fixtures/pc';

test('desktop mystery throws on a new win and restores one settled catch after restart', async ({}, info) => {
  test.setTimeout(75000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    await page.getByRole('button', { name: /Run query/ }).waitFor();
    await page.addInitScript(() => {
      if (sessionStorage.getItem('desktop-mystery-catch-seeded')) return;
      sessionStorage.setItem('desktop-mystery-catch-seeded', 'yes');
      localStorage.setItem('pokesql:mystery-round', JSON.stringify({ id: 'desktop-wailord', targetId: 321, level: 36, guessCount: 0, attempts: [] }));
      localStorage.setItem('pokesql:ball-theme', JSON.stringify('dusk-ball'));
    });
    await page.reload(); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    await page.locator('.cm-content').fill('SELECT id FROM pokedex WHERE id = 321;');
    await page.getByRole('button', { name: /Run query/ }).click();
    const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
    await expect(scene).toHaveClass(/is-catching/);
    await expect(scene.locator('.encounter-trainer')).toHaveClass(/is-throwing/);
    await expect(scene.locator('.encounter-catch-ball')).toHaveAttribute('src', /sprites\/items\/dusk-ball\.png$/);
    await expect(scene).toHaveClass(/is-caught/, { timeout: 10000 });
    await expect(scene.locator('.encounter-caption')).toHaveText('Gotcha! Wailord was caught!');
    expect((await collectionSnapshot(page)).captures).toHaveLength(1);
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    const restored = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
    await expect(restored).toHaveClass(/is-caught/);
    await expect(restored.locator('.encounter-trainer')).not.toHaveClass(/is-throwing/);
    await expect(restored.locator('.encounter-catch-ball')).toHaveCSS('animation-name', 'none');
    const captures = (await collectionSnapshot(page)).captures;
    expect(captures).toHaveLength(1);
    expect(captures[0]).toMatchObject({ pokemon: { id: 321 }, level: 36, ball: 'dusk-ball', attempts: 1, source: 'random' });
    await writeFile(info.outputPath('mystery-catch-state.json'), JSON.stringify(captures, null, 2));
  } finally { await app?.close().catch(() => {}); }
});
