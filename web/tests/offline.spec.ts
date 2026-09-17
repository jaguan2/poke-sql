import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('failed offline installation cleans partial files and succeeds after retry', async ({ page, context }) => {
  let failSprite = true;
  const root = path.resolve('dist');
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    // Exercise deployment under a subdirectory as well as retry behavior.
    if (!url.pathname.startsWith('/practice/')) { response.writeHead(404).end(); return; }
    if (failSprite && url.pathname.endsWith('/sprites/1025.png')) { response.writeHead(503).end(); return; }
    const asset = url.pathname.slice('/practice/'.length) || 'index.html';
    const filename = path.resolve(root, asset);
    if (path.relative(root, filename).startsWith('..')) { response.writeHead(404).end(); return; }
    try {
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml' };
      const content = await readFile(filename);
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', Vary: 'Origin' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/practice/`);
    await expect(page.getByRole('button', { name: /▶ Run/ })).toBeVisible();
    await expect(page.getByText('Offline download failed — reload to retry')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => caches.keys())).toEqual([]);
    failSprite = false;
    await page.reload();
    await expect(page.getByText('Available offline', { exact: true })).toBeVisible({ timeout: 20000 });
    await context.setOffline(true);
    await page.reload();
    // Select only two columns so the lazy sprite is actually in the viewport.
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('SELECT name, sprite_url FROM pokedex WHERE id = 1;');
    await page.getByRole('button', { name: /▶ Run/ }).click();
    await expect(page.locator('tbody tr').first().getByRole('cell', { name: 'Bulbasaur', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('img.sprite').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 96)).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
