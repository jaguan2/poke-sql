// Downloads database species, Safari shiny variants, and item sprites.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ballThemes from '../web/src/shared/pokemon/ball-themes.json' with { type: 'json' };
import shinyIds from '../web/src/shared/pokemon/shiny-sprites.json' with { type: 'json' };
const require = createRequire(new URL('../web/package.json', import.meta.url));
const SQL = await require('sql.js')();
const db = new SQL.Database(await readFile(new URL('../web/public/pokemon.sqlite', import.meta.url)));
const ids = db.exec('SELECT id FROM pokemon ORDER BY id')[0].values.map(row => row[0]);
db.close();
const directory = new URL('../web/public/sprites/', import.meta.url);
await mkdir(new URL('items/', directory), { recursive: true });
await mkdir(new URL('shiny/', directory), { recursive: true });
const sprites = [
  ...ids.map(id => ({ local: `${id}.png`, source: `pokemon/${id}.png` })),
  ...shinyIds.map(id => ({ local: `shiny/${id}.png`, source: `pokemon/shiny/${id}.png` })),
  ...ballThemes.map(theme => ({ local: `items/${theme.id}.png`, source: `items/${theme.id}.png` })),
];
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const valid = bytes => bytes.length > 32 && bytes.subarray(0, 8).equals(signature);
let index = 0;
let downloaded = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (index < sprites.length) {
    const sprite = sprites[index++];
    const target = new URL(sprite.local, directory);
    try { if (!process.argv.includes('--refresh') && valid(await readFile(target))) continue; } catch { /* download missing */ }
    for (let attempt = 0; ; attempt++) {
      const partial = fileURLToPath(target) + '.part';
      try {
        const response = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/${sprite.source}`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Sprite ${sprite.source}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!valid(bytes)) throw new Error(`Sprite ${sprite.source} is not a PNG`);
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
console.log(`Verified ${ids.length} species, ${shinyIds.length} shinies, and ${ballThemes.length} item sprites; downloaded ${downloaded}.`);
