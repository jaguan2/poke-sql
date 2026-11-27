import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import manifest from '../src/features/safari/world-assets.json' with { type: 'json' };

const digest = value => createHash('sha256').update(value).digest('hex');
const json = value => digest(JSON.stringify(value));
const load = file => readFile(new URL(`../public/safari/${file}`, import.meta.url));
const readJson = async file => JSON.parse(await load(file));
const fail = message => { throw new Error(`${message}. Rebuild with python scripts/export_world_maps.py kanto from the repository root.`); };

export async function checkWorldAssets(runtimeMaps, recipes) {
  if (manifest.version !== 1) fail('Unsupported world manifest');
  const outdoors = Object.entries(recipes).filter(([, recipe]) => ['town', 'route', 'forest'].includes(recipe.kind)).map(([id]) => id).sort();
  if (JSON.stringify(Object.keys(manifest.maps).sort()) !== JSON.stringify(outdoors)) fail('Export every Kanto and Hoenn outdoor map');
  for (const [file, hash] of Object.entries(manifest.generators)) {
    const code = await readFile(new URL(`../../scripts/${file}`, import.meta.url), 'utf8');
    if (digest(code.replaceAll('\r\n', '\n')) !== hash) fail(`World converter changed: ${file}`);
  }
  for (const [file, hash] of Object.entries(manifest.assets)) {
    const data = await load(file);
    if (!/^worlds\/(kanto|hoenn)\/[a-z\d.-]+$/.test(file)
      || digest(file.endsWith('.png') ? data : data.toString('utf8').replaceAll('\r\n', '\n')) !== hash) fail(`World asset changed: ${file}`);
  }
  for (const [id, entry] of Object.entries(manifest.maps)) {
    const runtime = runtimeMaps[id];
    if (!runtime || !manifest.assets[entry.metadata] || !manifest.assets[entry.tilemap]) fail(`Missing world asset: ${id}`);
    const metadata = await readJson(entry.metadata), map = await readJson(entry.tilemap);
    const width = runtime.rows[0].length, height = runtime.rows.length;
    if (metadata.terrain?.version !== 1 || !Array.isArray(metadata.terrain.rows) || metadata.terrain.rows.length !== height
      || metadata.terrain.rows.some(row => typeof row !== 'string' || row.length !== width || /[^.g~#Bsi><^v]/.test(row))) fail(`Invalid normalized terrain: ${id}`);
    if (metadata.formatVersion !== 1 || metadata.id !== `${entry.region}.${id}` || metadata.runtimeId !== id
      || metadata.region !== entry.region || metadata.width !== width || metadata.height !== height || entry.width !== width || entry.height !== height
      || metadata.recipeSha256 !== json(recipes[id]) || json(metadata.generators) !== json(manifest.generators)
      || metadata.runtimeLayoutSha256 !== json(runtime) || json(metadata.movementRows) !== json(runtime.rows)
      || json(metadata.transitions) !== json(runtime.portals) || json(metadata.spawnPoints.default) !== json(runtime.start)
      || map.type !== 'map' || map.infinite !== false || map.orientation !== 'orthogonal'
      || map.width !== width || map.height !== height || map.tilewidth !== 16 || map.tileheight !== 16
      || metadata.tileSize !== 16 || metadata.visualTileSize !== 16) fail(`World geometry differs: ${id}`);
    for (const [name, max] of [['metatile', 1023], ['collision', 3], ['elevation', 15], ['behavior', 511]]) {
      const values = metadata.cells[name];
      if (values.length !== width * height || values.some(n => !Number.isInteger(n) || n < 0 || n > max)) fail(`Invalid world ${name}: ${id}`);
    }
    const atlas = map.tilesets[0];
    if (map.tilesets.length !== 1 || atlas.firstgid !== 1 || !/^[a-z\d-]+\.png$/.test(atlas.image)) fail(`Invalid world atlas: ${id}`);
    const path = entry.tilemap.slice(0, entry.tilemap.lastIndexOf('/') + 1) + atlas.image;
    if (!manifest.assets[path]) fail(`Untracked world atlas: ${id}`);
    const png = await load(path);
    if (png.readUInt32BE(16) !== atlas.imagewidth || png.readUInt32BE(20) !== atlas.imageheight
      || atlas.imagewidth !== atlas.columns * 16 || atlas.imageheight % 16 !== 0
      || atlas.tilecount > atlas.columns * atlas.imageheight / 16) fail(`World atlas dimensions differ: ${id}`);
    const layers = map.layers.filter(layer => layer.type === 'tilelayer');
    if (layers.length !== 3 || layers.some((layer, index) => layer.name !== ['ground', 'details', 'foreground'][index]
      || layer.width !== width || layer.height !== height || layer.data.length !== width * height
      || layer.data.some(gid => !Number.isInteger(gid) || gid < 0 || gid > atlas.tilecount))) fail(`Invalid world layers: ${id}`);
  }
  console.log(`Verified ${Object.keys(manifest.maps).length} layered world maps, geometry and converter provenance.`);
}
