/** Deliberately small, finite orthogonal Tiled subset used by the visual pilot. */
export interface WorldTilemap {
  width: number; height: number; tilewidth: number; tileheight: number; backgroundcolor: string;
  layers: { name: string; type: "tilelayer"; data: number[] }[];
  tilesets: { firstgid: number; image: string; imagewidth: number; imageheight: number; columns: number; tilecount: number }[];
}

export function parseWorldTilemap(value: unknown, width: number, height: number): WorldTilemap {
  const map = value as WorldTilemap & { type: string; orientation: string; infinite: boolean };
  const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) > 0;
  if (!map || map.type !== "map" || map.orientation !== "orthogonal" || map.infinite !== false
    || map.width !== width || map.height !== height || !integer(width) || !integer(height)
    || !integer(map.tilewidth) || map.tilewidth !== map.tileheight || map.tilewidth > 64
    || width * map.tilewidth > 4096 || height * map.tileheight > 4096
    || !/^#[\da-f]{6}$/i.test(map.backgroundcolor) || !Array.isArray(map.tilesets) || map.tilesets.length !== 1) {
    throw new Error("Unsupported world tilemap");
  }
  const atlas = map.tilesets[0];
  if (!atlas || atlas.firstgid !== 1 || !/^[a-z\d-]+\.png$/.test(atlas.image)
    || !integer(atlas.columns) || !integer(atlas.tilecount) || !integer(atlas.imagewidth) || !integer(atlas.imageheight)
    || atlas.imagewidth !== atlas.columns * map.tilewidth || atlas.imageheight % map.tileheight !== 0
    || atlas.tilecount > atlas.columns * atlas.imageheight / map.tileheight) throw new Error("Unsupported world atlas");
  if (!Array.isArray(map.layers)) throw new Error("Missing world layers");
  const layers = map.layers.filter(layer => layer?.type === "tilelayer");
  if (layers.length !== 3 || layers.some((layer, index) => layer.name !== ["ground", "details", "foreground"][index]
    || !Array.isArray(layer.data) || layer.data.length !== width * height
    || layer.data.some(gid => !Number.isSafeInteger(gid) || gid < 0 || gid > atlas.tilecount))) {
    throw new Error("Invalid world tile layer");
  }
  return { ...map, layers };
}

/** Draw once at native resolution; the existing camera moves both surfaces together. */
export function drawWorldLayers(map: WorldTilemap, atlas: CanvasImageSource, ground: HTMLCanvasElement, foreground: HTMLCanvasElement) {
  for (const canvas of [ground, foreground]) {
    canvas.width = map.width * map.tilewidth;
    canvas.height = map.height * map.tileheight;
  }
  const back = ground.getContext("2d"), front = foreground.getContext("2d");
  if (!back || !front) throw new Error("Canvas rendering unavailable");
  back.imageSmoothingEnabled = front.imageSmoothingEnabled = false;
  back.fillStyle = map.backgroundcolor;
  back.fillRect(0, 0, ground.width, ground.height);
  const { columns } = map.tilesets[0], size = map.tilewidth;
  for (const layer of map.layers) {
    const context = layer.name === "foreground" ? front : back;
    layer.data.forEach((gid, index) => {
      if (!gid) return;
      const tile = gid - 1;
      context.drawImage(atlas, tile % columns * size, Math.floor(tile / columns) * size, size, size,
        index % map.width * size, Math.floor(index / map.width) * size, size, size);
    });
  }
}
