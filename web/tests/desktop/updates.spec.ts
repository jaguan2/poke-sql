import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { copyFile, readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { dump, load } from 'js-yaml';

test.skip(!process.env.POKESQL_EXECUTABLE, 'Update integration checks need desktop:build and a packaged POKESQL_EXECUTABLE.');

for (const scenario of ['offline', 'tampered', 'downloaded', 'differential'] as const) {
  test(`packaged updater ${scenario}: preserves the app, local-only renderer and saved SQL`, async ({}, info) => {
    const baseline = process.env.POKESQL_UPDATE_BASELINE;
    const differential = scenario === 'differential';
    test.skip(differential && !baseline, 'Build the previous-version fixture and set POKESQL_UPDATE_BASELINE to test differential transfers.');
    test.setTimeout(120000);
    const profile = info.outputPath('profile'), cache = info.outputPath('cache');
    await Promise.all([mkdir(profile, { recursive: true }), mkdir(cache, { recursive: true })]);
    const assetDirectory = path.resolve('release/nsis-web');
    const manifest = load(await readFile(path.join(assetDirectory, 'latest.yml'), 'utf8')) as {
      version: string; path: string; sha512: string; packages: { x64: { path: string; size: number; sha512: string; blockMapSize: number } };
    };
    const installerName = manifest.path, payload = manifest.packages.x64;
    const payloadPath = path.join(assetDirectory, payload.path);
    const installer = await readFile(path.join(assetDirectory, installerName));
    const expectedVersion = differential ? manifest.version : '99.0.0';
    const metadata = dump({ ...manifest, version: expectedVersion });
    const executablePath = differential ? path.join(baseline!, 'win-unpacked/PokeSQL.exe') : process.env.POKESQL_EXECUTABLE;
    if (differential) {
      const baselineDirectory = path.join(baseline!, 'nsis-web');
      const previous = load(await readFile(path.join(baselineDirectory, 'latest.yml'), 'utf8')) as typeof manifest;
      const { updaterCacheDirName } = load(await readFile(path.join(baseline!, 'win-unpacked/resources/app-update.yml'), 'utf8')) as { updaterCacheDirName: string };
      const packageCache = path.join(cache, updaterCacheDirName);
      await mkdir(packageCache, { recursive: true });
      await copyFile(path.join(baselineDirectory, previous.packages.x64.path), path.join(packageCache, 'package.7z'));
    }
    const corrupt = Buffer.from(installer); corrupt[0] ^= 0xff;
    const transfer = { ranges: 0, rangeBytes: 0, fullBytes: 0 };
    const server = createServer((request, response) => {
      const file = new URL(request.url!, 'http://localhost/').pathname.slice(1);
      if (file === 'latest.yml') { response.end(metadata); return; }
      if (file === installerName) { response.end(scenario === 'tampered' ? corrupt : installer); return; }
      if (file === payload.path) {
        if (!request.headers.range) {
          response.setHeader('Content-Length', payload.size);
          createReadStream(payloadPath).on('data', chunk => { transfer.fullBytes += chunk.length; }).pipe(response);
          return;
        }
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range);
        const start = Number(range?.[1]), end = Number(range?.[2]);
        if (!range || end < start || end >= payload.size) { response.writeHead(416).end(); return; }
        transfer.ranges++;
        response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${payload.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
        createReadStream(payloadPath, { start, end }).on('data', chunk => { transfer.rangeBytes += chunk.length; }).pipe(response);
        return;
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
      app = await electron.launch({ executablePath, args: [], env });
      const page = await app.firstWindow();
      await expect(page.getByRole('button', { name: /Run query/ })).toBeVisible();
      expect(await app.evaluate(({ app }) => app.getName())).toBe('poke-sql-web');
      await app.evaluate(({ app }, feed) => {
        const load = process.getBuiltinModule('node:module').createRequire(`${app.getAppPath()}/package.json`);
        const { NsisUpdater } = load('electron-updater');
        const { startUpdates } = load('./desktop/updates.cjs');
        const updater = new NsisUpdater({ provider: 'generic', url: feed, useMultipleRangeRequest: false });
        const state = { announcements: [] as string[], statuses: [] as string[], errors: [] as { code: string; message: string }[] };
        const logger = { info() {}, debug() {}, error() {}, warn(_message: unknown, error?: { code: string; message: string }) {
          if (error?.message) state.errors.push({ code: error.code ?? '', message: error.message });
        } };
        const { stop } = startUpdates(updater, (version: string) => state.announcements.push(version), logger,
          (status: { kind: string }) => state.statuses.push(status.kind));
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
      if (scenario === 'downloaded' || differential) {
        await expect.poll(() => app!.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.announcements), { timeout: 60000 }).toEqual([expectedVersion]);
        const pending = await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.updater.installerPath as string);
        expect(path.relative(cache, pending).startsWith('..')).toBe(false);
        expect(createHash('sha512').update(await readFile(pending)).digest('base64')).toBe(manifest.sha512);
        const savedPackage = path.join(path.dirname(pending), `package-${expectedVersion}.7z`);
        expect((await stat(savedPackage)).size).toBe(payload.size);
        const digest = createHash('sha512');
        for await (const chunk of createReadStream(savedPackage)) digest.update(chunk);
        expect(digest.digest('base64')).toBe(payload.sha512);
        expect(await app.evaluate(() => (globalThis as any).pokesqlUpdateTest.state.statuses)).toEqual(expect.arrayContaining(['downloading', 'ready']));
        await writeFile(info.outputPath('update-transfer.json'), JSON.stringify({ ...transfer, payloadBytes: payload.size, setupBytes: installer.length }, null, 2));
        expect(transfer.ranges).toBeGreaterThan(0);
        if (differential) {
          expect(transfer.fullBytes).toBe(0);
          expect(transfer.rangeBytes).toBeLessThan(payload.size * 0.25);
        } else expect(transfer.fullBytes).toBe(payload.size);
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
