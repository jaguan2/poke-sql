import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import tracks from '../../src/features/music/tracks.json' with { type: 'json' };
import { nearSafariGrass } from '../fixtures/safari';

test('desktop loads bundled SQL and sprites without Node access in the page', async ({}, testInfo) => {
  // This broad smoke includes native audio, a second process and a restart.
  // Hidden-window click stability waits can take ~2 seconds per action.
  test.setTimeout(60_000);
  const data = testInfo.outputPath('profile');
  await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({
    executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env,
  });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch();
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    await page.getByRole('button', { name: 'Get started', exact: true }).click();
    await expect(page.locator('.catalog-question')).toHaveCount(25);
    await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Hide menu', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Workspace menu' })).toHaveClass(/is-collapsed/);
    await page.getByRole('button', { name: 'Show menu', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Workspace menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'Master Ball', exact: true }).check();
    await page.getByRole('switch', { name: 'SQL autocomplete' }).uncheck();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.app')).toHaveCSS('background-color', 'rgb(118, 82, 154)');
    expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined');
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible();
    const music = page.locator('audio');
    expect(await music.evaluate(player => player.paused)).toBe(true);
    await music.scrollIntoViewIfNeeded();
    await music.click({ position: { x: 20, y: 18 } });
    await expect.poll(() => music.evaluate(player => !player.paused && player.currentTime > 0)).toBe(true);
    await music.evaluate(player => { player.currentTime = 30; });
    await expect.poll(() => music.evaluate(player => player.currentTime)).toBeGreaterThanOrEqual(30);
    await music.evaluate(player => player.pause());
    const musicRange = await page.evaluate(async file => {
      const response = await fetch(`music/${file}`, { headers: { Range: 'bytes=0-63' } });
      return { status: response.status, type: response.headers.get('Content-Type'), range: response.headers.get('Content-Range'), length: (await response.arrayBuffer()).byteLength };
    }, tracks[0].file);
    expect(musicRange).toMatchObject({ status: 206, type: 'audio/mpeg', length: 64 });
    expect(musicRange.range).toMatch(/^bytes 0-63\//);
    await page.getByRole('button', { name: 'Get started', exact: true }).click();
    await page.getByRole('button', { name: 'Top 10 Pokémon by HP', exact: true }).click();
    await page.getByText('Hint', { exact: true }).click();
    await expect(page.locator('.query-help pre:visible')).toContainText('ORDER BY hp DESC');
    await page.getByText('Answer', { exact: true }).click();
    await page.getByRole('article', { name: 'Direct approach' }).getByRole('button', { name: 'Use this answer' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await page.getByRole('button', { name: /▶ Run/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.locator('tbody tr').first()).toContainText('Blissey');
    await page.getByRole('button', { name: 'Back to free practice' }).click();
    await page.locator('.cm-content').click(); await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(`SELECT p.name, p.sprite_url, p.mega_form_count,
      (SELECT COUNT(*) FROM pokemon_forms f WHERE f.species_id=p.id AND f.is_mega=1) AS linked_megas
      FROM pokedex p WHERE p.id=6;`);
    await page.getByRole('button', { name: /▶ Run/ }).click();
    await expect(page.getByRole('cell', { name: 'Charizard', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2', exact: true })).toHaveCount(2);
    await expect.poll(() => page.locator('img.sprite').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 96)).toBe(true);
    // Hidden packaged windows may not produce compositor frames for screenshots.
    // Browser layout tests capture the shared frontend; this checks the shell.
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()))
      .toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true });
    // A second process must exit instead of opening another database snapshot
    // against the same persisted profile.
    await promisify(execFile)(await app.evaluate(() => process.execPath),
      process.env.POKESQL_EXECUTABLE ? [] : ['.'],
      { env, windowsHide: true, timeout: 10000 });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    const responses = await page.evaluate(async () => {
      const urls = ['/index.html', '/%2e%2e%2fpackage.json', '/%2e%2e%5cpackage.json', '/%zz'];
      return Promise.all(urls.map(async url => {
        const response = await fetch(url);
        return { status: response.status, csp: response.headers.get('Content-Security-Policy') };
      }));
    });
    expect(responses.map(response => response.status)).toEqual([200, 404, 404, 400]);
    expect(responses[0].csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    await page.locator('.cm-content').click(); await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('CREATE TABLE desktop_saved (value TEXT); INSERT INTO desktop_saved VALUES (\'Persisted\');');
    await page.getByRole('button', { name: /Run/ }).click();
    await expect(page.getByRole('button', { name: /Run/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Schema & guide', exact: true }).click();
    await expect(page.getByText('desktop_saved', { exact: true })).toBeVisible();
    await app.close();
    app = undefined;
    app = await launch();
    const reopened = await app.firstWindow();
    await expect(reopened.getByRole('button', { name: /Run/ })).toBeEnabled();
    await reopened.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(reopened.getByRole('radio', { name: 'Master Ball', exact: true })).toBeChecked();
    await expect(reopened.getByRole('switch', { name: 'SQL autocomplete' })).not.toBeChecked();
    await reopened.getByRole('button', { name: 'Done', exact: true }).click();
    await reopened.locator('.cm-content').click(); await reopened.keyboard.press('ControlOrMeta+A');
    await reopened.keyboard.insertText('SELECT value FROM desktop_saved;');
    await reopened.getByRole('button', { name: /Run/ }).click();
    await expect(reopened.getByRole('cell', { name: 'Persisted', exact: true })).toBeVisible();
  } finally {
    try {
      await app?.close();
    } finally {
      const relative = path.relative(path.resolve(testInfo.outputDir), path.resolve(data));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
    }
  }
});

test('desktop Safari loads its local trainer assets and persists a SQL catch', async ({}, testInfo) => {
  test.setTimeout(60000); // Profiles navigation, a catch and a persisted-profile reload.
  const data = testInfo.outputPath('profile');
  await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    app = await electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
      args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), nearSafariGrass());
    await page.reload();
    await page.clock.setFixedTime('2026-01-02T12:00:00Z');
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await expect(page.getByRole('row', { name: 'Virizion: not yet found', exact: true })).toContainText('1.0%');
    await page.locator('.safari-events > summary').click();
    await expect(page.getByRole('article', { name: 'Celebi Mythical event', exact: true })).toContainText('Active now');
    await page.locator('.safari-events > summary').click();
    const assets = await page.evaluate(async () => Promise.all(['safari/trainer-walking.png', 'safari/trainer-girl-walking.png', 'safari/trainer-girl-battle.png', 'safari/grass-effect.png', 'safari/trainer-battle.png', 'safari/maps/forest.png', 'safari/maps/tundra.png', 'safari/battle/grass.png', 'safari/battle/dialogue.png', 'safari/battle/nameplate.png', 'safari/battle/pixel.woff2'].map(async file => {
      const response = await fetch(file);
      return { status: response.status, size: (await response.arrayBuffer()).byteLength };
    })));
    expect(assets.every(asset => asset.status === 200 && asset.size > 100)).toBe(true);
    await expect(page.getByRole('table', { name: 'Verdant Forest encounter table' })).toBeVisible();
    await page.getByRole('button', { name: 'Profiles', exact: true }).click();
    const trainerNumber = await page.locator('.trainer-card-number strong').innerText();
    expect(trainerNumber).toMatch(/^\d{5}$/);
    await page.getByLabel('Trainer name', { exact: true }).fill('Jason');
    await page.getByRole('radio', { name: 'Steven', exact: true }).check();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.safari-player .trainer-sprite')).toHaveAttribute('data-trainer', 'steven');
    await page.getByRole('heading', { name: /Safari Zone/ }).click();
    await page.keyboard.press('a');
    await expect(page.getByRole('button', { name: /Check query & catch/ })).toBeVisible();
    expect(await page.evaluate(async () => (await document.fonts.load('16px "PokeSQL Battle"')).map(font => font.status))).toEqual(['loaded']);
    const battleScreen = (await page.locator('.safari-battle-scene').boundingBox())!;
    const caughtMarker = page.getByRole('img', { name: 'Already in your Pokédex', exact: true });
    await expect(caughtMarker).toHaveCount(0);
    const level = await page.locator('.encounter-nameplate small').textContent();
    expect(level).toMatch(/^Lv\.(?:[5-9]|[1-4]\d|50)$/);
    expect(battleScreen.width / battleScreen.height).toBeCloseTo(1.5, 2);
    const encounterWidth = (await page.locator('.safari-encounter').boundingBox())!.width;
    const contentWidth = await page.locator('.safari-zone').evaluate(element => {
      const style = getComputedStyle(element);
      return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    });
    expect(encounterWidth).toBeCloseTo(contentWidth, 0);
    expect(battleScreen.width).toBeLessThanOrEqual(encounterWidth);
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).encounter.pokemonId);
    await page.locator('.cm-content').focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(`SELECT id, name, type1, type2 FROM pokedex WHERE id=${id};`);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('.is-catching .safari-catch-ball')).toHaveAttribute('src', /sprites\/items\/poke-ball\.png$/);
    await expect(page.locator('.encounter-trainer')).toHaveAttribute('data-trainer', 'steven');
    await expect(page.locator('.safari-pokedex-entry')).toHaveCount(0);
    await expect(page.getByText('Gotcha!', { exact: false })).toBeVisible();
    const entry = page.locator('.safari-pokedex-entry');
    await expect(entry).toContainText('Pokédex data registered!');
    await expect(entry.locator('.safari-entry-description')).not.toBeEmpty();
    await expect(entry.getByRole('img')).toHaveAttribute('src', new RegExp(`/sprites/${id}\\.png$`));
    await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
    const caughtScreen = (await page.locator('.safari-battle-scene').boundingBox())!;
    expect(caughtScreen.width).toBeCloseTo(battleScreen.width, 1);
    expect(caughtScreen.height).toBeCloseTo(battleScreen.height, 1);
    await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
    await expect(page.locator('.encounter-sources')).toHaveText('Safari Zone');
    await page.reload();
    await page.getByRole('button', { name: /^My Pokédex/ }).click();
    await expect(page.locator('.encounter-card')).toHaveCount(1);
    await expect(page.locator('.encounter-sources')).toHaveText('Safari Zone');
    await page.getByRole('button', { name: 'Safari Zone', exact: true }).click();
    await expect(page.locator('.encounter-sprite')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.encounter-trainer')).toHaveAttribute('data-trainer', 'steven');
    await expect(caughtMarker).toBeVisible();
    await caughtMarker.evaluate((img: HTMLImageElement) => img.decode());
    await expect(entry).toContainText('Pokédex data registered!');
    await expect(page.locator('.encounter-nameplate small')).toHaveText(level!);
    await page.getByRole('button', { name: 'Profiles', exact: true }).click();
    await expect(page.getByLabel('Trainer name', { exact: true })).toHaveValue('Jason');
    await expect(page.locator('.trainer-card-number strong')).toHaveText(trainerNumber);
    await expect(page.getByRole('radio', { name: 'Steven', exact: true })).toBeChecked();
    await expect(page.locator('.profile-statistics dd').nth(1)).toHaveText('1');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Verdant Forest collection progress' })).toHaveAttribute('value', '1');
  } finally {
    try { await app?.close(); }
    finally {
      const relative = path.relative(path.resolve(testInfo.outputDir), path.resolve(data));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
    }
  }
});

test('desktop mystery uses original data and resumes its notebook after reload', async ({}, testInfo) => {
  const data = testInfo.outputPath('profile');
  await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    app = await electron.launch({
      executablePath: process.env.POKESQL_EXECUTABLE,
      args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env,
    });
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('pokesql:mystery-round', JSON.stringify({ targetId: 6, guessCount: 0, attempts: [] })));
    await page.reload();
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    const dailyTarget = await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:daily-mystery-round')!).targetId);
    const scene = page.getByRole('group', { name: 'Mystery Pokémon encounter', exact: true });
    await expect(scene.getByRole('img', { name: 'Mystery Pokémon', exact: true })).toBeVisible();
    await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
    const level = await scene.locator('.encounter-nameplate small').textContent();
    expect(level).toMatch(/^Lv\.(?:[5-9]|[1-4]\d|50)$/);
    await expect(scene.locator('.encounter-nameplate')).not.toContainText('No.');
    const bounds = (await scene.boundingBox())!;
    expect(bounds.width / bounds.height).toBeCloseTo(1.5, 2);
    await page.locator('.cm-editor').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(`SELECT id FROM pokedex WHERE id = ${dailyTarget}`);
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByText('Daily challenge completed.', { exact: false })).toBeVisible();
    await expect(scene.getByRole('img', { name: /^Revealed / })).toBeVisible();
    await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
    await page.reload();
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    await expect(page.getByText('Daily challenge completed.', { exact: false })).toBeVisible();
    await expect(scene.locator('.encounter-sprite img')).toHaveCSS('filter', 'none');
    expect(await page.evaluate(async () => (await document.fonts.load('16px "PokeSQL Battle"')).map(font => font.status))).toEqual(['loaded']);
    await expect(scene.locator('.encounter-nameplate small')).toHaveText(level!);
    await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    await page.locator('.cm-editor').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('SELECT id FROM pokedex WHERE id = 5');
    await page.getByRole('button', { name: /Guess Pokémon/ }).click();
    await expect(page.getByRole('row').filter({ hasText: '1. Charmeleon' })).toContainText('↑ Taller');
    await page.reload();
    await page.getByRole('button', { name: 'Who’s That Pokémon?', exact: true }).click();
    await page.getByRole('button', { name: 'Random practice', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: '1. Charmeleon' })).toBeVisible();
    await page.locator('.cm-editor').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('SELECT id FROM pokedex WHERE id = 6');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByText('You found Charizard in 2 guesses!', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'View Pokédex', exact: true }).click();
    await expect(page.locator('.encounter-card')).toHaveCount(new Set([dailyTarget, 6]).size);
    await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^My Pokédex/ }).click();
    await expect(page.locator('.encounter-card')).toHaveCount(new Set([dailyTarget, 6]).size);
    await expect(page.getByRole('article', { name: 'Charizard', exact: true })).toContainText('Random practice');
    await page.getByRole('button', { name: /^Achievements/ }).click();
    await expect(page.getByRole('article', { name: 'Gen 1 · Kanto', exact: true }).getByRole('progressbar')).toHaveAttribute('max', '151');
    await page.getByRole('button', { name: 'Types', exact: true }).click();
    const fireProgress = page.getByRole('article', { name: 'Fire collector', exact: true }).getByRole('progressbar');
    await expect(fireProgress).toHaveAttribute('max', '81');
    expect(Number(await fireProgress.getAttribute('value'))).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined');
  } finally {
    try { await app?.close(); }
    finally {
      const relative = path.relative(path.resolve(testInfo.outputDir), path.resolve(data));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(data, { recursive: true, force: true });
    }
  }
});
