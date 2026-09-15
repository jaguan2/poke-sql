// Downloads only the species included in the committed database. No Python needed.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const SQL = await require('sql.js')();
const db = new SQL.Database(await readFile(new URL('../web/public/pokemon.sqlite', import.meta.url)));
const ids = db.exec('SELECT id FROM pokemon ORDER BY id')[0].values.map(row => row[0]);
db.close();
const directory = new URL('../web/public/sprites/', import.meta.url);
await mkdir(directory, { recursive: true });
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const valid = bytes => bytes.length > 32 && bytes.subarray(0, 8).equals(signature);
let index = 0;
let downloaded = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (index < ids.length) {
    const id = ids[index++];
    const target = new URL(`${id}.png`, directory);
    try { if (!process.argv.includes('--refresh') && valid(await readFile(target))) continue; } catch { /* download missing */ }
    for (let attempt = 0; ; attempt++) {
      const partial = fileURLToPath(target) + '.part';
      try {
        const response = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Sprite ${id}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!valid(bytes)) throw new Error(`Sprite ${id} is not a PNG`);
        await writeFile(partial, bytes);
        await rename(partial, target);
        downloaded++;
        break;
      } catch (error) {
        await rm(partial, { force: true });
        if (attempt >= 2) throw error;
      }
    }
  }
}));
console.log(`Verified ${ids.length} local sprites; downloaded ${downloaded}.`);
