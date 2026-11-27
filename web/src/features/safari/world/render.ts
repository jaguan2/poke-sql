import type { WorldAsset } from "./assets";
import type { Player } from "./physics";
import type { WildPokemon } from "./wild";
import { TRAINERS, type TrainerId } from "../../../shared/trainer/profile";
import trainers from "../route-trainers.json" with { type: "json" };
import spriteBounds from "../../../shared/pokemon/sprite-bounds.json";

export interface PlacedMap { asset: WorldAsset; x: number; y: number }
export interface Camera { x: number; y: number }
export function createImages() {
  const images = new Map<string, HTMLImageElement>();
  const get = (path: string) => {
    let image = images.get(path);
    if (!image) {
      image = new Image(); image.src = `${import.meta.env.BASE_URL}${path}`;
      images.set(path, image);
      if (images.size > 16) images.delete(images.keys().next().value!);
    }
    return image;
  };
  return Object.assign(get, { clear: () => images.clear() });
}

/** Only visible tiles are submitted; animation and camera updates do not render React. */
export function renderOverworld(canvas: HTMLCanvasElement, placed: readonly PlacedMap[], origin: { x: number; y: number },
  player: Player, wild: readonly WildPokemon[], trainer: TrainerId, camera: Camera, clock: number,
  getImage: ReturnType<typeof createImages>, debug: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = placed[0]?.asset.map.backgroundcolor ?? "#9acbab"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cameraX = Math.round(camera.x * 16), cameraY = Math.round(camera.y * 16);
  const drawLayer = (placement: PlacedMap, layerIndex: number, bridgesOnly = false) => {
    const { map, atlas, terrain } = placement.asset, layer = map.layers[layerIndex];
    const left = Math.max(0, Math.floor(camera.x - placement.x)), top = Math.max(0, Math.floor(camera.y - placement.y));
    const right = Math.min(map.width, Math.ceil(camera.x + canvas.width / 16 - placement.x)), bottom = Math.min(map.height, Math.ceil(camera.y + canvas.height / 16 - placement.y));
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (bridgesOnly && terrain?.rows[y][x] !== "B") continue;
      const gid = layer.data[y * map.width + x];
      if (!gid) continue;
      const tile = gid - 1, columns = map.tilesets[0].columns;
      ctx.drawImage(atlas, tile % columns * 16, Math.floor(tile / columns) * 16, 16, 16,
        Math.round((placement.x + x) * 16) - cameraX, Math.round((placement.y + y) * 16) - cameraY, 16, 16);
    }
  };
  for (const p of placed) { drawLayer(p, 0); drawLayer(p, 1); }
  type Npc = { x: number; y: number; kind: string; facing: string };
  const npcs: readonly Npc[] = (trainers.locations as Record<string, Npc[]>)[player.mapId] ?? [];
  const actors: { y: number; entity?: WildPokemon; npc?: Npc }[] = [
    ...wild.map(entity => ({ y: entity.position.y, entity })), ...npcs.map(npc => ({ y: npc.y, npc })),
  ];
  const drawPlayer = () => {
    const profile = TRAINERS[trainer].walking, image = getImage(`safari/${profile.file}`);
    if (!image.complete || !image.naturalWidth) return;
    const walking = Math.hypot(player.velocity.x, player.velocity.y) > .05;
    const pose = player.direction === "down" ? [0, 3, 0, 4] : player.direction === "up" ? [1, 5, 1, 6] : [2, 7, 2, 8];
    const frame = pose[walking ? Math.floor(clock * (player.mode === "running" ? 12 : 8)) % 4 : 0];
    const x = Math.round((origin.x + player.position.x + .5) * 16) - cameraX;
    const y = Math.round((origin.y + player.position.y + .5) * 16) - cameraY;
    if (player.mode === "surfing" || player.transition?.mode === "surfing") {
      ctx.strokeStyle = "#bdeeff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y + 2, 8 + Math.sin(clock * 5), 3, 0, 0, Math.PI * 2); ctx.stroke();
      const mount = getImage("sprites/131.png");
      const bounds = spriteBounds["131"];
      if (mount.complete && mount.naturalWidth) ctx.drawImage(mount, bounds.left, bounds.top, bounds.width, bounds.height, x - 15, y - 5, 30, 25);
    } else { ctx.fillStyle = "#233b3b55"; ctx.beginPath(); ctx.ellipse(x, y + 3, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(x, y - (player.transition?.jump ? Math.sin(player.transition.elapsed / player.transition.duration * Math.PI) * 8 : 0));
    if (player.direction === "right") ctx.scale(-1, 1);
    const riding = player.mode === "surfing" || player.transition?.mode === "surfing";
    ctx.drawImage(image, frame * image.naturalWidth / profile.columns, 0, image.naturalWidth / profile.columns,
      image.naturalHeight * (riding ? .75 : 1), -8, -25, 16, riding ? 24 : 32);
    ctx.restore();
  };
  let paintedPlayer = false;
  actors.sort((a, b) => a.y - b.y);
  for (const actor of actors) {
    if (!paintedPlayer && player.position.y < actor.y) { drawPlayer(); paintedPlayer = true; }
    if (actor.npc) {
      const npc = actor.npc, sprite = (trainers.sprites as Record<string, { file: string }>)[npc.kind];
      const image = getImage(`safari/${sprite.file}`), frame = ["down", "up", "left", "right"].indexOf(npc.facing);
      if (image.complete && image.naturalWidth) ctx.drawImage(image, frame * 16, 0, 16, 32,
        Math.round((origin.x + npc.x + .5) * 16) - cameraX - 8, Math.round((origin.y + npc.y + .5) * 16) - cameraY - 25, 16, 32);
      continue;
    }
    const entity = actor.entity!;
    const image = getImage(`sprites/${entity.pokemonId}.png`);
    if (!image.complete || !image.naturalWidth) continue;
    const x = Math.round((origin.x + entity.position.x + .5) * 16) - cameraX, y = Math.round((origin.y + entity.position.y + .5) * 16) - cameraY;
    const bounds = (spriteBounds as Record<string, { left: number; top: number; width: number; height: number }>)[entity.pokemonId];
    const scale = Math.min(1, 22 / Math.max(bounds.width, bounds.height)), width = bounds.width * scale, height = bounds.height * scale;
    ctx.drawImage(image, bounds.left, bounds.top, bounds.width, bounds.height, x - width / 2,
      y - height + 3 + Math.sin(clock * 2 + entity.pokemonId) * .6, width, height);
  }
  if (!paintedPlayer) drawPlayer();
  for (const p of placed) {
    drawLayer(p, 2);
    if (player.mode === "surfing") for (let layer = 0; layer < 3; layer++) drawLayer(p, layer, true);
  }
  if (debug) {
    ctx.strokeStyle = "#ffe45c"; ctx.strokeRect((origin.x + player.position.x + .28) * 16 - cameraX, (origin.y + player.position.y + .28) * 16 - cameraY, .44 * 16, .44 * 16);
    for (const p of placed) {
      const terrain = p.asset.terrain;
      if (!terrain) continue;
      for (let y = 0; y < terrain.height; y++) for (let x = 0; x < terrain.width; x++) {
        const px = (p.x + x) * 16 - cameraX, py = (p.y + y) * 16 - cameraY;
        if (px < -16 || py < -16 || px > canvas.width || py > canvas.height) continue;
        if (terrain.rows[y][x] === "#") { ctx.fillStyle = "#ff404033"; ctx.fillRect(px, py, 16, 16); }
      }
    }
  }
}
