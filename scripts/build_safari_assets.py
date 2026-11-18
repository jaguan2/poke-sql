"""Build local Safari maps from pinned Emerald tiles, palettes and metatiles.

Requires Pillow. Raw inputs are cached under web/.cache; committed output PNGs
are sufficient to run the app. No game ROM, account or runtime download is used.
"""
import hashlib
import json
import re
import struct
from collections import deque
from functools import cache
from pathlib import Path

from PIL import Image
from build_safari_battle import build_battle_assets
from safari_sources import ROOT, EMERALD_REVISION as REVISION, source

OUTPUT = ROOT / "web/public/safari"
FEATURE = ROOT / "web/src/features/safari"


class Tileset:
    def __init__(self, secondary):
        primary = "data/tilesets/primary/general"
        extra = f"data/tilesets/secondary/{secondary}" if secondary else None
        self.sheets = [Image.open(source(primary + "/tiles.png")),
                       Image.open(source(extra + "/tiles.png")) if extra else None]
        self.blocks = [source(primary + "/metatiles.bin").read_bytes(),
                       source(extra + "/metatiles.bin").read_bytes() if extra else None]
        self.attributes = [source(primary + "/metatile_attributes.bin").read_bytes(),
                           source(extra + "/metatile_attributes.bin").read_bytes() if extra else None]
        self.palettes = []
        for index in range(16):
            directory = extra if extra and 6 <= index <= 12 else primary
            lines = source(f"{directory}/palettes/{index:02}.pal").read_text().splitlines()
            self.palettes.append([tuple(map(int, line.split())) for line in lines[3:19]])
        # These tiles are loaded into VRAM by the game's animation callbacks,
        # rather than stored in tiles.png. Use the original first frame.
        self.sheets[0] = self.sheets[0].copy()
        for name, offset in [("water", 432), ("sand_water_edge", 464),
                             ("land_water_edge", 480), ("waterfall", 496), ("flower", 508)]:
            frame = Image.open(source(f"{primary}/anim/{name}/0.png"))
            for index in range(frame.width // 8 * (frame.height // 8)):
                tile = frame.crop((index % (frame.width // 8) * 8, index // (frame.width // 8) * 8,
                                   index % (frame.width // 8) * 8 + 8, index // (frame.width // 8) * 8 + 8))
                self.sheets[0].paste(tile, ((offset + index) % 16 * 8, (offset + index) // 16 * 8))

    @cache
    def metatile(self, reference):
        bank, number = reference.split(":")
        # Emerald: a 16x16 metatile has two layers, each with four 8x8 tiles.
        result = Image.new("RGBA", (16, 16))
        for cell, entry in enumerate(struct.unpack_from("<8H", self.blocks[1 if bank == "S" else 0], int(number) * 16)):
            tile_id, palette = entry & 0x3FF, entry >> 12
            sheet = self.sheets[1 if tile_id >= 512 else 0]
            if sheet is None:
                raise ValueError(f"Secondary tile required for {reference}")
            tile_id %= 512
            x, y = tile_id % 16 * 8, tile_id // 16 * 8
            tile = sheet.crop((x, y, x + 8, y + 8))
            pixels = Image.new("RGBA", (8, 8))
            pixels.putdata([self.palettes[palette][value] + (255 if value else 0,) for value in tile.getdata()])
            if entry & 0x400:
                pixels = pixels.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if entry & 0x800:
                pixels = pixels.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            result.alpha_composite(pixels, ((cell % 4) % 2 * 8, (cell % 4) // 2 * 8))
        return result


def build_route(recipe, layout):
    secondary = re.sub(r"(?<!^)(?=[A-Z])", "_", layout["secondary_tileset"].removeprefix("gTileset_")).lower()
    tiles = Tileset(secondary)
    blocks = struct.unpack(f"<{layout['width'] * layout['height']}H", source(layout["blockdata_filepath"]).read_bytes())
    left, top, width, height = recipe["crop"]
    if min(left, top) < 0 or left + width > layout["width"] or top + height > layout["height"]:
        raise ValueError(f"Invalid crop for {recipe['layout']}")
    image = Image.new("RGBA", (width * 16, height * 16))
    cells = {}
    # Surfing, ledge jumps and building warps are outside this walking minigame.
    blocked = set(range(0x10, 0x16)) | {0x18, 0x19, 0x1A, 0x22, 0x2A, 0x2B} | set(range(0x30, 0x40)) | set(range(0x50, 0x70))
    for y in range(height):
        for x in range(width):
            block = blocks[(top + y) * layout["width"] + left + x]
            number = block & 0x3FF
            bank, index = (1, number - 512) if number >= 512 else (0, number)
            behavior = struct.unpack_from("<H", tiles.attributes[bank], index * 2)[0] & 0xFF
            image.alpha_composite(tiles.metatile(f"{'S' if bank else 'G'}:{index}"), (x * 16, y * 16))
            if not (block & 0xC00) and behavior not in blocked:
                cells[x, y] = "g" if behavior in recipe["encounters"] else "."
    # Explicit trailheads determine the playable section, never an arbitrary
    # largest component that can strand the trainer away from route landmarks.
    start = tuple(recipe["entrance"])
    if start not in cells:
        raise ValueError(f"Blocked route entrance for {recipe['layout']}: {start}")
    cells[start] = "."
    distances = {start: 0}
    queue = deque([start])
    while queue:
        x, y = queue.popleft()
        for point in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
            if point in cells and point not in distances:
                distances[point] = distances[x, y] + 1
                queue.append(point)
    accessible = distances.keys()
    patches = [point for point in accessible if cells[point] == "g" and cells.get((point[0] + 1, point[1])) == "g"]
    if not patches:
        raise ValueError(f"No reachable encounter area in {recipe['layout']}")
    rustle = min(patches, key=lambda point: (distances[point], point))
    rows = ["".join(cells[x, y] if (x, y) in accessible else "#" for x in range(width)) for y in range(height)]
    return image, {"rows": rows, "start": dict(zip(("x", "y"), start)),
                   "rustle": dict(zip(("x", "y"), rustle)), "name": recipe["name"]}


def build():
    recipes = json.loads((FEATURE / "routes.json").read_text(encoding="utf-8"))
    layouts = {entry["name"].removesuffix("_Layout"): entry for entry in json.loads(source("data/layouts/layouts.json").read_text())["layouts"]}
    (OUTPUT / "maps").mkdir(parents=True, exist_ok=True)
    generated = []
    maps = {}
    for name, recipe in recipes.items():
        image, maps[name] = build_route(recipe, layouts[recipe["layout"]])
        target = f"maps/{name}.png"
        image.save(OUTPUT / target)
        generated.append(target)
        print(f"{name}: {image.width // 16}x{image.height // 16}, start {maps[name]['start']}, grass {sum(row.count('g') for row in maps[name]['rows'])}")
    (FEATURE / "maps.json").write_text(json.dumps(maps, indent=2) + "\n", encoding="utf-8")

    for name, original in [("grass-effect.png", "tall_grass"), ("dust-effect.png", "ground_impact_dust")]:
        image = Image.open(source(f"graphics/field_effects/pics/{original}.png"))
        image.save(OUTPUT / name, transparency=0)
        generated.append(name)
    battle_files, sprite_bounds, sprite_source_hash = build_battle_assets(OUTPUT)
    generated.extend(battle_files)
    manifest = []
    for name in generated:
        entry = {"file": name, "sha256": hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest()}
        if name.startswith("maps/"):
            recipe = recipes[Path(name).stem]
            entry["recipeSha256"] = hashlib.sha256(json.dumps(recipe, separators=(",", ":")).encode()).hexdigest()
            entry["layoutSha256"] = hashlib.sha256(json.dumps(maps[Path(name).stem], separators=(",", ":")).encode()).hexdigest()
        manifest.append(entry)
    metadata = {"spriteSourceSha256": sprite_source_hash, "spriteBounds": sprite_bounds, "assets": manifest}
    (FEATURE / "assets.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(recipes)} Emerald route maps, FireRed battle art/font/trainers, and {len(sprite_bounds)} sprite bounds.")


if __name__ == "__main__":
    build()
