import bagItems from '../src/features/safari/bag-items.json' with { type: 'json' };
import { readFile, readdir } from 'node:fs/promises';
import safariMaps from '../src/features/safari/maps.json' with { type: 'json' };
import safariRoutes from '../src/features/safari/routes.json' with { type: 'json' };
import kantoMaps from '../src/features/safari/kanto-maps.json' with { type: 'json' };
import kantoRoutes from '../src/features/safari/kanto-routes.json' with { type: 'json' };
import kantoManifest from '../src/features/safari/kanto-assets.json' with { type: 'json' };
import hoennMaps from '../src/features/safari/hoenn-maps.json' with { type: 'json' };
import hoennRoutes from '../src/features/safari/hoenn-routes.json' with { type: 'json' };
import hoennManifest from '../src/features/safari/hoenn-assets.json' with { type: 'json' };
import johtoMaps from '../src/features/safari/johto-maps.json' with { type: 'json' };
import johtoRoutes from '../src/features/safari/johto-routes.json' with { type: 'json' };
import johtoManifest from '../src/features/safari/johto-assets.json' with { type: 'json' };
import regionOverviews from '../src/features/safari/region-overviews.json' with { type: 'json' };
import routeTrainers from '../src/features/safari/route-trainers.json' with { type: 'json' };
import initSqlJs from 'sql.js';
import ballThemes from '../src/shared/pokemon/ball-themes.json' with { type: 'json' };
import shinyIds from '../src/shared/pokemon/shiny-sprites.json' with { type: 'json' };
import kantoTracks from '../src/features/music/kanto-tracks.json' with { type: 'json' };
import hoennTracks from '../src/features/music/hoenn-tracks.json' with { type: 'json' };
import johtoTracks from '../src/features/music/johto-tracks.json' with { type: 'json' };
import trainers from '../src/shared/trainer/profiles.json' with { type: 'json' };
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
// This JSON is shared with typed gameplay code; reject invalid IDs at build time.
const bagIds = ['repel', 'super-repel', 'max-repel', 'shiny-charm'];
if (bagItems.length !== bagIds.length || bagIds.some(id => bagItems.filter(item => item.id === id).length !== 1)
  || bagItems.some(item => !['items', 'key-items'].includes(item.pocket) || !Number.isInteger(item.steps) || item.steps < 0
    || !Number.isInteger(item.starter) || item.starter < 0 || !Number.isInteger(item.rewardEvery) || item.rewardEvery < 0)) {
  throw new Error('Invalid Bag manifest. Keep bag-items.json aligned with bag-model.ts and the bundled item sprites.');
}
const sprites = [...ids.map(id => `${id}.png`), ...ballThemes.map(theme => `items/${theme.id}.png`), ...bagItems.map(item => `items/${item.id}.png`)];
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
for (const id of shinyIds) {
  const file = `shiny/${id}.png`;
  const data = await readFile(new URL(`../public/sprites/${file}`, import.meta.url)).catch(() => null);
  const bounds = spriteBounds[id];
  if (!data || data.length < 32 || data.readUInt32BE(0) !== 0x89504e47 || !bounds
    || bounds.canvasWidth !== data.readUInt32BE(16) || bounds.canvasHeight !== data.readUInt32BE(20)) {
    throw new Error(`Missing or invalid shiny sprite ${file}. Run npm run sprites before building.`);
  }
}
const safariAssets = safariManifest.assets;
for (const trainer of Object.values(trainers)) {
  if (trainer.battle.throwFrames.length !== 5) throw new Error(`${trainer.label} must define five throwing poses in shared/trainer/profiles.json.`);
  if (trainer.battle.releasePoint.length !== 2 || trainer.battle.releasePoint.some(value => !Number.isFinite(value) || value < 0 || value > 64)) throw new Error(`Invalid throwing hand position for ${trainer.label}. Check shared/trainer/profiles.json.`);
  for (const [pose, frameWidth, frameHeight] of [['walking', 16, 32], ['battle', 64, 64], ['portrait', 64, 64]]) {
    const sheet = trainer[pose];
    const file = sheet.file;
    const data = await readFile(new URL(`../public/safari/${file}`, import.meta.url));
    if (!safariAssets.some(asset => asset.file === file) || data.readUInt32BE(16) !== frameWidth * sheet.columns || data.readUInt32BE(20) !== frameHeight * sheet.rows) {
      throw new Error(`Invalid ${pose} trainer sheet ${file}. Run py scripts/build_trainers.py from the repository root.`);
    }
    if (pose === 'battle' && [sheet.idleFrame, ...sheet.throwFrames].some(frame => !Number.isInteger(frame) || frame < 0 || frame >= sheet.columns * sheet.rows)) throw new Error(`Invalid battle poses in ${file}. Check shared/trainer/profiles.json.`);
  }
}
console.log(`Verified ${ids.length} species, ${shinyIds.length} shinies, and ${ballThemes.length + bagItems.length} bundled item sprites.`);
const regionalTracks = [...kantoTracks, ...hoennTracks, ...johtoTracks];
const musicFiles = (await readdir(new URL('../public/music/', import.meta.url), { recursive: true }))
  .filter(file => file.endsWith('.mp3')).map(file => file.replaceAll('\\', '/')).sort();
if (JSON.stringify(musicFiles) !== JSON.stringify(regionalTracks.map(track => track.file).sort())) {
  throw new Error('Bundled MP3 files must match the game soundtrack catalogue. Remove unused music files or register their source and hash.');
}
for (const track of regionalTracks) {
  const data = await readFile(new URL(`../public/music/${track.file}`, import.meta.url));
  if (createHash('sha256').update(data).digest('hex') !== track.sha256) {
    throw new Error(`Bundled music changed: ${track.file}. Restore the checked-in asset or follow its rebuild instructions in public/music/CREDITS.txt.`);
  }
}
console.log(`Verified ${regionalTracks.length} game soundtrack recordings; no unused MP3 files.`);
for (const [id, layout] of Object.entries({ ...kantoMaps, ...hoennMaps, ...johtoMaps })) {
  if (regionalTracks.filter(track => track.nativeMusic === layout.music).length !== 1) throw new Error(`Regional location ${id} needs exactly one matching music theme.`);
}
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
async function verifyRegion(name, routes, maps, manifest) {
for (const [id, recipe] of Object.entries(routes)) {
  const asset = manifest.assets.find(asset => asset.file === `${id}.png`);
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if (!asset || asset.recipeSha256 !== digest(recipe) || asset.layoutSha256 !== digest(maps[id])) {
    throw new Error(`Regional map ${id} is stale. Run py scripts/build_region_assets.py ${name} from the repository root.`);
  }
  const data = await readFile(new URL(`../public/safari/${name}/${asset.file}`, import.meta.url));
  if (createHash('sha256').update(data).digest('hex') !== asset.sha256
    || data.readUInt32BE(16) !== maps[id].rows[0].length * 16 || data.readUInt32BE(20) !== maps[id].rows.length * 16) {
    throw new Error(`Regional art must match its collision map: ${id}. Run py scripts/build_region_assets.py ${name} from the repository root.`);
  }
}
console.log(`Verified ${manifest.assets.length} bundled ${name} maps.`);
}
await Promise.all([verifyRegion('kanto', kantoRoutes, kantoMaps, kantoManifest), verifyRegion('hoenn', hoennRoutes, hoennMaps, hoennManifest), verifyRegion('johto', johtoRoutes, johtoMaps, johtoManifest)]);
for (const [region, routes] of Object.entries({ kanto: kantoRoutes, johto: johtoRoutes, hoenn: hoennRoutes })) {
  const atlas = regionOverviews[region];
  const data = await readFile(new URL(`../public/safari/${atlas.file}`, import.meta.url));
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if (digest(routes) !== atlas.recipeSha256 || digest(atlas.points) !== atlas.pointsSha256
    || createHash('sha256').update(data).digest('hex') !== atlas.sha256
    || data.readUInt32BE(16) !== atlas.width || data.readUInt32BE(20) !== atlas.height
    || Object.keys(routes).length !== Object.keys(atlas.points).length
    || Object.keys(routes).some(id => !atlas.points[id] || atlas.points[id].x < 0 || atlas.points[id].x >= atlas.width || atlas.points[id].y < 0 || atlas.points[id].y >= atlas.height)
    || atlas.markers.some(id => !routes[id])) {
    throw new Error(`Native ${region} town map is stale. Run py scripts/build_region_overviews.py from the repository root.`);
  }
}
console.log('Verified three native town maps and all regional location anchors.');
const regionalLayouts = { ...kantoMaps, ...hoennMaps, ...johtoMaps };
if (Object.keys(routeTrainers.locations).length !== Object.keys(regionalLayouts).length) throw new Error('Rebuild route trainers for all regional maps.');
for (const [id, layout] of Object.entries(regionalLayouts)) {
  const trainers = routeTrainers.locations[id];
  if (!trainers || new Set(trainers.map(npc => `${npc.x},${npc.y}`)).size !== trainers.length || trainers.some(npc =>
    !Number.isInteger(npc.x) || !Number.isInteger(npc.y) || !routeTrainers.sprites[npc.kind]
    || !['up', 'down', 'left', 'right'].includes(npc.facing) || !'.gS'.includes(layout.rows[npc.y]?.[npc.x] ?? '!')
    || layout.portals.some(p => Math.abs(p.x - npc.x) <= 1 && Math.abs(p.y - npc.y) <= 1))) throw new Error(`Invalid route trainers in ${id}. Run py scripts/build_route_trainers.py.`);
}
for (const sprite of Object.values(routeTrainers.sprites)) {
  const data = await readFile(new URL(`../public/safari/${sprite.file}`, import.meta.url));
  if (data.readUInt32BE(16) !== 64 || data.readUInt32BE(20) !== 32 || createHash('sha256').update(data).digest('hex') !== sprite.sha256) throw new Error(`Invalid decorative trainer sheet ${sprite.file}.`);
}
console.log(`Verified ${Object.keys(routeTrainers.sprites).length} decorative trainer sheets and regional object positions.`);
