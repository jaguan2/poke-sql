"""Decode Crystal's 32px blocks into native artwork and 16px walking cells."""
import re
from functools import cache
from PIL import Image
from safari_sources import source


def text(path):
    return source(path, "crystal").read_text(encoding="utf-8")


def rgb_rows(path):
    rows = []
    for line in text(path).splitlines():
        if line.strip().startswith("RGB "):
            values = list(map(int, re.findall(r"\d+", line.split(";")[0])))
            rows.append([tuple(round(v * 255 / 31) for v in values[i:i + 3]) for i in range(0, len(values), 3)])
    return rows


class CrystalTileset:
    def __init__(self, name, group, environment, time):
        self.sheet = Image.open(source(f"gfx/tilesets/{name}.png", "crystal")).convert("L")
        self.blocks = source(f"data/tilesets/{name}_metatiles.bin", "crystal").read_bytes()
        self.collisions = [line.split(";", 1)[0].split("tilecoll", 1)[1].strip().split(", ")
                           for line in text(f"data/tilesets/{name}_collision.asm").splitlines() if "tilecoll " in line]
        self.pal_map = {}
        offsets = {0: 0, 1: 128}
        names = ["GRAY", "RED", "GREEN", "WATER", "YELLOW", "BROWN", "ROOF", "TEXT"]
        for bank, entries in re.findall(r"tilepal ([01]), ([^\n]+)", text(f"gfx/tilesets/{name}_palette_map.asm")):
            bank = int(bank)
            for entry in entries.split(", "):
                self.pal_map[offsets[bank]] = names.index(entry.strip())
                offsets[bank] += 1
        palettes = rgb_rows("gfx/tilesets/bg_tiles.pal")
        if environment in ("TOWN", "ROUTE"):
            indices = [8, 9, 10, 40, 12, 13, 14, 15]
        elif time == "PALETTE_NITE":
            indices = list(range(16, 24))
        else:
            indices = [32, 33, 34, 35, 36, 37, 38, 7]
        self.palettes = [palettes[i][:] for i in indices]
        if environment in ("TOWN", "ROUTE"):
            self.palettes[6][1:3] = rgb_rows("gfx/tilesets/roofs.pal")[group * 2]
        if name in ("johto", "johto_modern"):
            roofs = [line.strip().split()[1] for line in text("data/maps/roofs.asm").split("MapGroupRoofs:", 1)[1].splitlines() if line.strip().startswith("db ")]
            roof = roofs[group].removeprefix("ROOF_").lower()
            if roof != "-1":
                image = Image.open(source(f"gfx/tilesets/roofs/{roof}.png", "crystal")).convert("L")
                for i in range(image.width * image.height // 64):
                    tile = image.crop((i % (image.width // 8) * 8, i // (image.width // 8) * 8,
                                       i % (image.width // 8) * 8 + 8, i // (image.width // 8) * 8 + 8))
                    self.sheet.paste(tile, ((10 + i) % 16 * 8, (10 + i) // 16 * 8))

    @cache
    def block(self, number):
        image = Image.new("RGB", (32, 32))
        for i, tile_id in enumerate(self.blocks[number * 16:number * 16 + 16]):
            index = tile_id if tile_id < 128 else tile_id - 32
            tile = self.sheet.crop((index % 16 * 8, index // 16 * 8, index % 16 * 8 + 8, index // 16 * 8 + 8))
            palette = self.palettes[self.pal_map[tile_id]]
            pixels = Image.new("RGB", (8, 8))
            pixels.putdata([palette[3 - value // 85] for value in tile.getdata()])
            image.paste(pixels, (i % 4 * 8, i // 4 * 8))
        return image


def build_maps(recipes, output):
    constants, group = {}, 0
    for line in text("constants/map_constants.asm").splitlines():
        if re.match(r"\s*newgroup \w+", line):
            group += 1
        match = re.match(r"\s*map_const (\w+),\s*(\d+),\s*(\d+)", line)
        if match:
            constants[match[1]] = (int(match[2]), int(match[3]), group)
    headers = {m[0]: m[1:] for m in re.findall(r"^\s*map (\w+), TILESET_(\w+), (\w+), \w+, (MUSIC_\w+), \w+, (PALETTE_\w+)", text("data/maps/maps.asm"), re.M)}
    attributes, current = {}, None
    for line in text("data/maps/attributes.asm").splitlines():
        match = re.match(r"\s*map_attributes (\w+), (\w+),", line)
        if match:
            current = match[1]
            attributes[current] = {"constant": match[2], "connections": []}
        match = re.match(r"\s*connection (\w+), (\w+), \w+, (-?\d+)", line)
        if match:
            attributes[current]["connections"].append((match[1], match[2], int(match[3]) * 2))
    block_paths, labels = {}, []
    for line in text("data/maps/blocks.asm").splitlines():
        match = re.match(r"(\w+)_Blocks:", line)
        if match:
            labels.append(match[1])
        match = re.search(r'INCBIN "([^"]+)"', line)
        if match:
            block_paths.update({label: match[1] for label in labels})
            labels = []
    native_ids = {r["native"]: id for id, r in recipes.items()}
    constant_ids = {attributes[native]["constant"]: id for native, id in native_ids.items()}
    warps = {id: [(int(x), int(y), dest, int(index)) for x, y, dest, index in re.findall(
        r"warp_event\s+(\d+),\s*(\d+),\s*(\w+),\s*(-?\d+)", text(f"maps/{r['native']}.asm"))] for id, r in recipes.items()}
    maps = {}
    for id, recipe in recipes.items():
        native = recipe["native"]
        width, height, group = constants[attributes[native]["constant"]]
        tileset, environment, music, time = headers[native]
        tiles = CrystalTileset(tileset.lower(), group, environment, time)
        blocks = source(block_paths[native], "crystal").read_bytes()
        if len(blocks) != width * height:
            raise ValueError(f"Invalid native block dimensions: {native}")
        image = Image.new("RGB", (width * 32, height * 32))
        # Exploration has no HM/story locks. Clear only Cut trees, using the
        # same tileset's floor; permanent trees and water keep their collisions.
        floor_block = next(i for i, row in enumerate(tiles.collisions) if row == ["FLOOR"] * 4)
        cleared_floor = tiles.block(floor_block).crop((0, 0, 16, 16))
        cells = [["#"] * (width * 2) for _ in range(height * 2)]
        for i, block in enumerate(blocks):
            x, y = i % width, i // width
            image.paste(tiles.block(block), (x * 32, y * 32))
            for quadrant, collision in enumerate(tiles.collisions[block]):
                tile = "#"
                if collision.startswith("HOP_"):
                    tile = str(["RIGHT", "LEFT", "UP", "DOWN", "DOWN_RIGHT", "DOWN_LEFT", "UP_RIGHT", "UP_LEFT"].index(collision[4:]))
                elif collision == "UP_WALL":
                    tile = "U"
                elif collision == "CUT_TREE":
                    tile = "g" if recipe["pool"] and environment == "CAVE" else "."
                    image.paste(cleared_floor, (x * 32 + quadrant % 2 * 16, y * 32 + quadrant // 2 * 16))
                elif collision in ("FLOOR", "TALL_GRASS", "LONG_GRASS", "LADDER", "CAVE", "DOOR", "WARP_CARPET_DOWN", "WARP_CARPET_LEFT", "WARP_CARPET_RIGHT", "WARP_CARPET_UP"):
                    tile = "g" if recipe["pool"] and (collision in ("TALL_GRASS", "LONG_GRASS") or environment == "CAVE") else "."
                cells[y * 2 + quadrant // 2][x * 2 + quadrant % 2] = tile
        for x, y, dest, _ in warps[id]:
            cells[y][x] = "." if dest in constant_ids else "#"
        image.save(output / f"{id}.png")
        safe = [(x, y) for y, row in enumerate(cells) for x, tile in enumerate(row) if tile == "."]
        start = min(safe, key=lambda p: abs(p[0] - recipe["entrance"][0]) + abs(p[1] - recipe["entrance"][1]))
        maps[id] = {"rows": ["".join(row) for row in cells], "music": music, "start": dict(zip(("x", "y"), start)), "rustle": None, "portals": []}
    for id, recipe in recipes.items():
        width, height = len(maps[id]["rows"][0]), len(maps[id]["rows"])
        for direction, native, offset in attributes[recipe["native"]]["connections"]:
            target = native_ids.get(native)
            if target is None:
                continue
            tw, th = len(maps[target]["rows"][0]), len(maps[target]["rows"])
            for n in range(width if direction in ("north", "south") else height):
                if direction == "north": x, y, tx, ty = n, -1, n - offset, th - 1
                elif direction == "south": x, y, tx, ty = n, height, n - offset, 0
                elif direction == "west": x, y, tx, ty = -1, n, tw - 1, n - offset
                else: x, y, tx, ty = width, n, 0, n - offset
                if maps[id]["rows"][max(0, min(y, height - 1))][max(0, min(x, width - 1))] in ".g" and 0 <= tx < tw and 0 <= ty < th and maps[target]["rows"][ty][tx] in ".g":
                    maps[id]["portals"].append({"x": x, "y": y, "to": target, "arrival": {"x": tx, "y": ty}})
        for x, y, dest, index in warps[id]:
            if dest in constant_ids:
                target = constant_ids[dest]
                tx, ty, *_ = warps[target][index - 1]
                maps[id]["portals"].append({"x": x, "y": y, "to": target, "arrival": {"x": tx, "y": ty}})
    return maps
