"""Render the original FireRed, Crystal and Emerald town maps, with native anchors.

Run from the repository root with Python + Pillow. Pinned pret source files are
cached by safari_sources; the application uses only the generated local PNGs.
"""
import hashlib
import json
import re
import struct

from PIL import Image
from safari_sources import ARCHIVES, ROOT, source

FEATURE = ROOT / "web/src/features/safari"
OUTPUT = ROOT / "web/public/safari/region-maps"


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


class GameSource:
    def __init__(self, archive):
        self.archive = archive
        self.files = {}

    def file(self, path):
        file = source(path, self.archive)
        self.files[path] = hashlib.sha256(file.read_bytes()).hexdigest()
        return file

    def text(self, path):
        return self.file(path).read_text(encoding="utf-8")


def gba_map(game, image_path, palette_path, tilemap_path, affine=False):
    tiles = Image.open(game.file(image_path))
    colors = [tuple(map(int, line.split())) for line in game.text(palette_path).splitlines()[3:]]
    raw = game.file(tilemap_path).read_bytes()
    entries = raw if affine else struct.unpack(f"<{len(raw) // 2}H", raw)
    columns, rows = (64, 64) if affine else (30, 20)
    canvas = Image.new("RGB", (columns * 8, rows * 8))
    for index, entry in enumerate(entries):
        tile_id = entry if affine else entry & 0x3FF
        bank = 0 if affine else entry >> 12
        x, y = tile_id % 16 * 8, tile_id // 16 * 8
        tile = tiles.crop((x, y, x + 8, y + 8))
        rgb = Image.new("RGB", (8, 8))
        # Emerald's affine background loads its palette at color 0x70.
        rgb.putdata([colors[max(0, pixel - 0x70)] if affine else colors[bank * 16 + pixel % 16] for pixel in tile.getdata()])
        if not affine and entry & 0x400:
            rgb = rgb.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if not affine and entry & 0x800:
            rgb = rgb.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        canvas.paste(rgb, (index % columns * 8, index // columns * 8))
    return canvas


def gba_points(game, recipes, region):
    sections = {s["id"]: s for s in json.loads(game.text("src/data/region_map/region_map_sections.json"))["map_sections"]}
    dungeons = {}
    if region == "kanto":
        cells = re.findall(r"\bMAPSEC_[A-Z_0-9]+", game.text("src/data/region_map/region_map_layout_kanto.h"))
        for i, section in enumerate(cells[22 * 15:]):
            if section != "MAPSEC_NONE":
                dungeons.setdefault(section, (i % 22, i // 22))
    points = {}
    for id, recipe in recipes.items():
        data = json.loads(game.text(f"data/maps/{recipe['native']}/map.json"))
        section_id = data["region_map_section"]
        section = sections[section_id]
        x, y = dungeons.get(section_id, (section["x"] + (section["width"] - 1) / 2, section["y"] + (section["height"] - 1) / 2))
        # FireRed cursor origins are (36,36); trim only the unused screen edge.
        points[id] = {"x": int(12 + x * 8), "y": int(20 + y * 8)}
    return points


def crystal_map(game):
    tiles = Image.open(game.file("gfx/pokegear/town_map.png"))
    colors = [tuple(round(int(v) * 255 / 31) for v in rgb) for rgb in re.findall(r"RGB\s+(\d+),\s*(\d+),\s*(\d+)", game.text("gfx/pokegear/pokegear.pal"))]
    names = ["BORDER", "EARTH", "MOUNTAIN", "CITY", "POI", "POI_MTN"]
    banks = [names.index(name) for line in game.text("gfx/pokegear/town_map_palette_map.asm").splitlines() if line.startswith("\ttownmappals ")
             for name in re.findall(r"\b(?:BORDER|EARTH|MOUNTAIN|CITY|POI_MTN|POI)\b", line)]
    raw = game.file("gfx/pokegear/johto.bin").read_bytes()
    if len(raw) != 361 or raw[-1] != 255 or max(raw[:-1]) >= 48:
        raise ValueError("Unexpected Crystal town-map tile layout")
    canvas = Image.new("RGB", (160, 144))
    for index, tile_id in enumerate(raw[:-1]):
        x, y = tile_id % 16 * 8, tile_id // 16 * 8
        tile = tiles.crop((x, y, x + 8, y + 8))
        rgb = Image.new("RGB", (8, 8))
        rgb.putdata([colors[banks[tile_id] * 4 + (255 - pixel) // 85] for pixel in tile.getdata()])
        canvas.paste(rgb, (index % 20 * 8, index // 20 * 8))
    return canvas


def crystal_points(game, recipes):
    # The assembly macro adds the Game Boy OAM hardware offset (8,16).
    # Background coordinates use the original landmark values, before that offset.
    landmarks = {name: {"x": int(x), "y": int(y)} for x, y, name in re.findall(r"\tlandmark\s+(-?\d+),\s*(-?\d+),\s*(\w+)Name", game.text("data/maps/landmarks.asm"))}
    names = {"UnionCave1F": "UnionCave", "SlowpokeWellB1F": "SlowpokeWell"}
    return {id: landmarks[names.get(recipes[recipe.get("landmark", id)]["native"], recipes[recipe.get("landmark", id)]["native"])] for id, recipe in recipes.items()}


def map_markers(recipes, points):
    # Several cave entrances share one native map square. Keep one readable
    # marker there; every floor/gate/route stays selectable in the Area list.
    rank = {"town": 0, "forest": 1, "cave": 1, "route": 2, "gate": 3}
    markers = []
    for id in sorted(recipes, key=lambda id: rank[recipes[id]["kind"]]):
        if recipes[id].get("overview") is False:
            continue
        p = points[id]
        if all(abs(p["x"] - points[other]["x"]) >= 8 or abs(p["y"] - points[other]["y"]) >= 8 for other in markers):
            markers.append(id)
    return markers


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    metadata = {}
    for region, archive, title in [("kanto", "firered", "Pokémon FireRed"), ("johto", "crystal", "Pokémon Crystal"), ("hoenn", "emerald", "Pokémon Emerald")]:
        game = GameSource(archive)
        recipes = json.loads((FEATURE / f"{region}-routes.json").read_text(encoding="utf-8"))
        if region == "kanto":
            image = gba_map(game, "graphics/region_map/region_map.png", "graphics/region_map/region_map.pal", "graphics/region_map/kanto.bin").crop((24, 16, 216, 160))
        elif region == "hoenn":
            image = gba_map(game, "graphics/pokenav/region_map/map.png", "graphics/pokenav/region_map/map.pal", "graphics/pokenav/region_map/map.bin", affine=True).crop((0, 0, 240, 160))
        else:
            image = crystal_map(game)
        points = crystal_points(game, recipes) if region == "johto" else gba_points(game, recipes, region)
        file = OUTPUT / f"{region}.png"
        image.save(file)
        metadata[region] = {"file": f"region-maps/{region}.png", "game": title, "width": image.width, "height": image.height,
                            "revision": ARCHIVES[archive][1], "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                            "recipeSha256": digest(recipes), "pointsSha256": digest(points), "sources": game.files,
                            "points": points, "markers": map_markers(recipes, points)}
        print(f"{region}: {image.width}x{image.height}, {len(points)} native anchors, {len(metadata[region]['markers'])} map markers")
    (FEATURE / "region-overviews.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
