import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { dump } from 'js-yaml';

test.skip(!process.env.POKESQL_EXECUTABLE, 'Update integration checks need desktop:build and a packaged POKESQL_EXECUTABLE.');

for (const scenario of ['offline', 'tampered', 'downloaded'] as const) {
  test(`packaged updater ${scenario}: preserves the app, local-only renderer and saved SQL`, async ({}, info) => {
    test.setTimeout(90000);
    const profile = info.outputPath('profile'), cache = info.outputPath('cache');
    await Promise.all([mkdir(profile, { recursive: true }), mkdir(cache, { recursive: true })]);
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const installerName = `PokeSQL-${pkg.version}-setup.exe`, payloadName = `poke-sql-web-${pkg.version}-x64.nsis.7z`;
    const assetDirectory = path.resolve('release/nsis-web');
    const installer = await readFile(path.join(assetDirectory, installerName));
    const payload = await readFile(path.join(assetDirectory, payloadName));
    const metadata = dump({ version: '99.0.0', path: installerName,
      sha512: createHash('sha512').update(installer).digest('base64'),
      files: [{ url: installerName, sha512: createHash('sha512').update(installer).digest('base64'), size: installer.length }],
      packages: { x64: { path: payloadName, sha512: createHash('sha512').update(payload).digest('base64'), size: payload.length } } });
    const corrupt = Buffer.from(installer); corrupt[0] ^= 0xff;
    const server = createServer((request, response) => {
      const file = new URL(request.url!, 'http://localhost/').pathname.slice(1);
      if (file === 'latest.yml') { response.end(metadata); return; }
      if (file === installerName) { response.end(scenario === 'tampered' ? corrupt : installer); return; }
      if (file === payloadName) {
        response.setHeader('Content-Length', payload.length);
        createReadStream(path.join(assetDirectory, payloadName)).pipe(response); return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const feed = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    if (scenario === 'offline') await new Promise<void>(resolve => server.close(() => resolve()));
    const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: profile, LOCALAPPDATA: cache };
    delete env.ELECTRON_RUN_AS_NODE;
    let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
    try {
      app = await electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE ?? path.resolve('release/win-unpacked/PokeSQL.exe'), args: [], env });
      const page = await app.firstWindow();
      await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
      expect(await app.evaluate(({ app }) => app.getName())).toBe('poke-sql-web');
      await app.evaluate(({ app }, feed) => {
        const load = process.getBuiltinModule('node:module').createRequire(`${app.getAppPath()}/package.json`);
        const { NsisUpdater } = load('electron-updater');
        const { startUpdates } = load('./desktop/updates.cjs');
        const updater = new NsisUpdater({ provider: 'generic', url: feed });
        updater.disableDifferentialDownload = true;
        const state = { announcements: [] as string[], errors: [] as { code: string; message: string }[] };
        const logger = { info() {}, debug() {}, error() {}, warn(_message: unknown, error?: { code: string; message: string }) {
          if (error?.message) state.errors.push({ code: error.code ?? '', message: error.message });
        } };
        const stop = startUpdates(updater, (version: string) => state.announcements.push(version), logger);
        // Exercise real downloads/checksums, but never execute a test installer.
        updater.autoInstallOnAppQuit = false;
        Object.assign(globalThis, { pokesqlUpdateTest: { state, updater, stop } });
      }, feed);
      const edit = async (sql: string) => {
        await page.locator('.cm-content').focus(); await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.insertText(sql); await page.getByRole('button', { name: /Run query/ }).click();
      };
      const readSavedSql = 'SELECT value FROM update_save;';
      const savedValue = page.getByRole('cell', { name: 'Still here', exact: true });
      await edit(`CREATE TABLE update_save (value TEXT); INSERT INTO update_save VALUES ('Still here'); ${readSavedSql}`);
      await expect(savedValue).toBeVisible();
      if (scenario === 'downloaded') {
        await expect.poll(() => app!.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.announcements), { timeout: 40000 }).toEqual(['99.0.0']);
        const pending = await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.updater.installerPath as string);
        expect(path.relative(cache, pending).startsWith('..')).toBe(false);
        expect(createHash('sha512').update(await readFile(pending)).digest('base64')).toBe(createHash('sha512').update(installer).digest('base64'));
        expect((await stat(path.join(path.dirname(pending), 'package-99.0.0.7z'))).size).toBe(payload.length);
      } else {
        await expect.poll(() => app!.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.errors.length), { timeout: 20000 }).toBeGreaterThan(0);
        if (scenario === 'tampered') expect(await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.errors[0].code)).toBe('ERR_CHECKSUM_MISMATCH');
        if (scenario === 'offline') expect(await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.errors[0].message)).toMatch(/CONNECTION_REFUSED|ECONNREFUSED/);
        expect(await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.announcements)).toEqual([]);
      }
      await edit(readSavedSql);
      await expect(savedValue).toBeVisible();
      expect(await page.evaluate(() => typeof (globalThis as any).require)).toBe('undefined');
      expect(await page.evaluate(async feed => { try { await fetch(feed); return 'allowed'; } catch { return 'blocked'; } }, feed)).toBe('blocked');
      await page.reload();
      await expect(page.locator('.cm-content')).toHaveText(readSavedSql);
      await page.getByRole('button', { name: /Run query/ }).click();
      await expect(savedValue).toBeVisible();
    } finally {
      if (app) {
        await app.evaluate(() => { const run = (globalThis as any).pokesqlUpdateTest; if (run) { run.updater.autoInstallOnAppQuit = false; run.stop(); } }).catch(() => {});
        await app.close();
      }
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
}
