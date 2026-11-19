import { readFile } from 'node:fs/promises';
import safariMaps from '../src/features/safari/maps.json' with { type: 'json' };
import safariRoutes from '../src/features/safari/routes.json' with { type: 'json' };
import initSqlJs from 'sql.js';
import ballThemes from '../src/features/settings/themes.json' with { type: 'json' };
import tracks from '../src/features/music/tracks.json' with { type: 'json' };
import safariManifest from '../src/features/safari/assets.json' with { type: 'json' };
import spriteBounds from '../src/shared/pokemon/sprite-bounds.json' with { type: 'json' };
import pokedex from '../src/shared/pokemon/pokedex-entries.json' with { type: 'json' };
import { createHash } from 'node:crypto';
const SQL = await initSqlJs();
const db = new SQL.Database(await readFile(new URL('../public/pokemon.sqlite', import.meta.url)));
const species = db.exec('SELECT id, genus FROM pokemon ORDER BY id')[0].values;
const ids = species.map(row => row[0]);
db.close();
if (Object.keys(pokedex.entries).length !== ids.length || species.some(([id, category]) => {
  const entry = pokedex.entries[id];
  return !entry || entry.category !== category || typeof entry.description !== 'string' || !entry.description.trim()
    || /[\r\n\f]/.test(entry.description) || typeof entry.version !== 'string' || !entry.version.trim();
})) throw new Error('Pokédex descriptions must cover every bundled species. Run py scripts/build_pokedex_entries.py from the repository root.');
console.log(`Verified ${ids.length} bundled English Pokédex descriptions.`);
const missing = [];
const sprites = [...ids.map(id => `${id}.png`), ...ballThemes.map(theme => `items/${theme.id}.png`)];
const spriteDigest = createHash('sha256');
for (const sprite of sprites) {
  let data;
  try {
    data = await readFile(new URL(`../public/sprites/${sprite}`, import.meta.url));
  } catch { missing.push(sprite); continue; }
  if (data.length < 32 || data.readUInt32BE(0) !== 0x89504e47) { missing.push(sprite); continue; }
  if (!sprite.startsWith('items/')) {
    spriteDigest.update(sprite).update(data);
    const bounds = spriteBounds[sprite.slice(0, -4)];
    if (!bounds || bounds.canvasWidth !== data.readUInt32BE(16) || bounds.canvasHeight !== data.readUInt32BE(20)
      || bounds.width <= 0 || bounds.height <= 0 || bounds.left < 0 || bounds.top < 0
      || bounds.left + bounds.width > bounds.canvasWidth || bounds.top + bounds.height > bounds.canvasHeight) {
      throw new Error(`Invalid Safari sprite geometry for ${sprite}. Run py scripts/build_safari_assets.py from the repository root.`);
    }
  }
}
if (missing.length) throw new Error(`${missing.length} sprites missing or invalid. Run npm run sprites before building.`);
if (spriteDigest.digest('hex') !== safariManifest.spriteSourceSha256) throw new Error('Safari sprite geometry is stale. Run py scripts/build_safari_assets.py from the repository root.');
if (createHash('sha256').update(JSON.stringify(spriteBounds)).digest('hex') !== safariManifest.spriteBoundsSha256) throw new Error('Sprite geometry changed. Run py scripts/build_safari_assets.py from the repository root.');
const safariAssets = safariManifest.assets;
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
for (const [id, recipe] of Object.entries(safariRoutes)) {
  const asset = safariAssets.find(asset => asset.file === `maps/${id}.png`);
  if (!asset || asset.recipeSha256 !== createHash('sha256').update(JSON.stringify(recipe)).digest('hex')
    || asset.layoutSha256 !== createHash('sha256').update(JSON.stringify(safariMaps[id])).digest('hex')) {
    throw new Error(`Safari map ${id} must match its collision layout. Run py scripts/build_safari_assets.py from the repository root to rebuild the pinned game tiles.`);
  }
}
for (const asset of safariAssets) {
  const data = await readFile(new URL(`../public/safari/${asset.file}`, import.meta.url));
  if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Safari asset changed: ${asset.file}. Check the asset and its source credits before updating its hash.`);
}
console.log(`Verified ${safariAssets.length} bundled Safari assets.`);
