import { readFile } from 'node:fs/promises';
import initSqlJs from 'sql.js';
import ballThemes from '../src/ball-themes.json' with { type: 'json' };
import tracks from '../src/music-tracks.json' with { type: 'json' };
import { createHash } from 'node:crypto';
const SQL = await initSqlJs();
const db = new SQL.Database(await readFile(new URL('../public/pokemon.sqlite', import.meta.url)));
const ids = db.exec('SELECT id FROM pokemon')[0].values.map(row => row[0]);
db.close();
const missing = [];
const sprites = [...ids.map(id => `${id}.png`), ...ballThemes.map(theme => `items/${theme.id}.png`)];
for (const sprite of sprites) {
  try {
    const data = await readFile(new URL(`../public/sprites/${sprite}`, import.meta.url));
    if (data.length < 32 || data.readUInt32BE(0) !== 0x89504e47) missing.push(sprite);
  } catch { missing.push(sprite); }
}
if (missing.length) throw new Error(`${missing.length} sprites missing or invalid. Run npm run sprites before building.`);
console.log(`Verified ${ids.length} species and ${ballThemes.length} bundled item sprites.`);
// OC ReMix permits redistribution of the original MP3s, without retagging or
// transcoding. Hash checks keep that constraint part of every production build.
for (const track of tracks) {
  const data = await readFile(new URL(`../public/music/${track.file}`, import.meta.url));
  if (createHash('sha256').update(data).digest('hex') !== track.sha256) {
    throw new Error(`Bundled music changed: ${track.file}. Restore the unchanged MP3 from ${track.source}.`);
  }
}
console.log(`Verified ${tracks.length} unchanged bundled music tracks.`);
