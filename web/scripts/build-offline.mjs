import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return result.flat().filter(name => name !== 'sw.js').sort();
}
const paths = await files(root);
const hash = createHash('sha256');
for (const path of paths) { hash.update(path); hash.update(await readFile(new URL(path, root))); }
const version = hash.digest('hex').slice(0, 16);
const source = `// Generated from every production asset; scoped to this deployment path.
const PREFIX = 'pokesql-offline:' + self.registration.scope + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(paths)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  for (let i = 0; i < ASSETS.length; i += 32) {
    await cache.addAll(ASSETS.slice(i, i + 32).map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') return (await cache.match(new URL('index.html', self.registration.scope))) || fetch(event.request);
    // These are our own immutable static assets. Ignore Vary: Origin from
    // static hosts: module scripts and precache requests send different Origin headers.
    return (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request);
  })());
});
`;
await writeFile(new URL('sw.js', root), source);
console.log(`Offline cache: ${paths.length} assets (${version}).`);
