"""Vendor Kanto, Hoenn and Johto journeys from pinned game maps.

Full native maps, edge offsets and staircase/forest-gate warps are preserved.
Only included destinations are connected; water and unopened interiors stay
blocked. Run from the repository root with Python + Pillow; no ROM is required.
"""
import hashlib
import json
import re
import struct
import argparse
from functools import cache
from collections import deque

from PIL import Image
from build_safari_assets import Tileset
from safari_sources import ROOT, ARCHIVES, source

FEATURE = ROOT / "web/src/features/safari"


def read(path, archive):
    return json.loads(source(path, archive).read_text())


def snake(name):
    words = re.sub(r"(?<!^)(?=[A-Z])", "_", name.removeprefix("gTileset_"))
    return re.sub(r"(?<=[a-z])(?=\d)", "_", words).lower()


@cache
def tileset(primary, secondary, archive):
    return Tileset(snake(secondary), archive, snake(primary))


def build_map(recipe, layout, data, archive):
    width, height = layout["width"], layout["height"]
    tiles = tileset(layout["primary_tileset"], layout["secondary_tileset"], archive)
    blocks = struct.unpack(f"<{width * height}H", source(layout["blockdata_filepath"], archive).read_bytes())
    image = Image.new("RGBA", (width * 16, height * 16), tiles.palettes[0][0] + (255,))
    cells = []
    # Native one-way ledges become direction tiles; the movement model jumps
    # over them only in their original direction. No surf/cut/story flags.
    blocked = set(range(0x10, 0x16)) | {0x19, 0x1A, 0x1B} | set(range(0x30, 0x38)) | set(range(0x40, 0x60))
    for y in range(height):
        row = []
        for x in range(width):
            block = blocks[y * width + x]
            number = block & 0x3FF
            bank, index = (1, number - tiles.split) if number >= tiles.split else (0, number)
            size, fmt = (4, "<I") if archive == "firered" else (2, "<H")
            behavior = struct.unpack_from(fmt, tiles.attributes[bank], index * size)[0] & (0x1FF if archive == "firered" else 0xFF)
            image.alpha_composite(tiles.metatile(f"{'S' if bank else 'G'}:{index}"), (x * 16, y * 16))
            tile = "#"
            if behavior in range(0x38, 0x3C):
                tile = "><^v"[behavior - 0x38]
            elif not block & 0xC00 and behavior not in blocked:
                encounters = (2, 8, 11) if archive == "firered" else (2, 3, 8, 9, 11)
                tile = "g" if behavior in encounters and recipe["kind"] not in ("town", "gate") else "."
            row.append(tile)
        cells.append(row)
    # Only native warps to included locations are walkable. Town buildings
    # remain solid; their PC service is available from the town panel.
    included = recipe["included"]
    for warp in data["warp_events"]:
        cells[warp["y"]][warp["x"]] = "." if warp["dest_map"] in included else "#"
    anchor = recipe["entrance"]
    safe = [(x, y) for y, row in enumerate(cells) for x, tile in enumerate(row) if tile == "."]
    start = min(safe, key=lambda p: (abs(p[0] - anchor[0]) + abs(p[1] - anchor[1]), p))
    grass = [(x, y) for y, row in enumerate(cells) for x, tile in enumerate(row) if tile == "g"]
    rustle = min(grass, key=lambda p: (abs(p[0] - start[0]) + abs(p[1] - start[1]), p)) if grass else None
    return image, {"rows": ["".join(row) for row in cells], "music": data["music"], "start": dict(zip(("x", "y"), start)),
                   "rustle": dict(zip(("x", "y"), rustle)) if rustle else None, "portals": []}


def advance_maps(recipes, output, archive):
    layouts = {entry["id"]: entry for entry in read("data/layouts/layouts.json", archive)["layouts"] if "id" in entry}
    data = {id: read(f"data/maps/{recipe['native']}/map.json", archive) for id, recipe in recipes.items()}
    native_ids = {entry["id"]: id for id, entry in data.items()}
    maps = {}
    for id, recipe in recipes.items():
        print(f"Rendering {id}", flush=True)
        image, maps[id] = build_map({**recipe, "included": native_ids}, layouts[data[id]["layout"]], data[id], archive)
        image.save(output / f"{id}.png")

    def walkable(id, x, y):
        rows = maps[id]["rows"]
        return 0 <= y < len(rows) and 0 <= x < len(rows[0]) and rows[y][x] in ".gU01234567"

    for id, entry in data.items():
        width, height = len(maps[id]["rows"][0]), len(maps[id]["rows"])
        portals = maps[id]["portals"]
        for connection in entry["connections"] or []:
            target = native_ids.get(connection["map"])
            if not target:
                continue
            tw, th = len(maps[target]["rows"][0]), len(maps[target]["rows"])
            offset, direction = connection["offset"], connection["direction"]
            for n in range(width if direction in ("up", "down") else height):
                if direction == "up": x, y, tx, ty = n, -1, n - offset, th - 1
                elif direction == "down": x, y, tx, ty = n, height, n - offset, 0
                elif direction == "left": x, y, tx, ty = -1, n, tw - 1, n - offset
                else: x, y, tx, ty = width, n, 0, n - offset
                if walkable(id, max(0, min(x, width - 1)), max(0, min(y, height - 1))) and walkable(target, tx, ty):
                    portals.append({"x": x, "y": y, "to": target, "arrival": {"x": tx, "y": ty}})
        for warp in entry["warp_events"]:
            target = native_ids.get(warp["dest_map"])
            if target:
                arrival = data[target]["warp_events"][int(warp["dest_warp_id"])]
                if not walkable(target, arrival["x"], arrival["y"]):
                    raise ValueError(f"Blocked arrival from {id} to {target}")
                portals.append({"x": warp["x"], "y": warp["y"], "to": target, "arrival": {"x": arrival["x"], "y": arrival["y"]}})
    return maps


def build(region):
    if region == "sinnoh":
        from build_sinnoh_assets import build as build_sinnoh
        build_sinnoh(region)
        return
    archive, origin = {"kanto": ("firered", "pallet-town"), "hoenn": ("emerald", "littleroot-town"),
                       "johto": ("crystal", "new-bark-town")}[region]
    output = ROOT / "web/public/safari" / region
    output.mkdir(parents=True, exist_ok=True)
    recipes = json.loads((FEATURE / f"{region}-routes.json").read_text(encoding="utf-8"))
    if archive == "crystal":
        from crystal_maps import build_maps
        maps = build_maps(recipes, output)
    else:
        maps = advance_maps(recipes, output, archive)
    manifest = []

    def walkable(id, x, y):
        rows = maps[id]["rows"]
        return 0 <= y < len(rows) and 0 <= x < len(rows[0]) and rows[y][x] in ".gU01234567"
    # Keep the connected journey, including rooms reached through other maps.
    # A per-map flood would incorrectly remove Mt. Moon's separate chambers.
    directions = [(0, -1, "^"), (0, 1, "v"), (-1, 0, "<"), (1, 0, ">")]
    seen, queue = set(), deque([(origin, maps[origin]["start"])])
    while queue:
        id, position = queue.popleft()
        x, y = position["x"], position["y"]
        if (id, x, y) in seen:
            continue
        seen.add((id, x, y))
        rows = maps[id]["rows"]
        for dx, dy, ledge in directions:
            nx, ny = x + dx, y + dy
            # Runtime travel checks the next tile before applying ledge jumps.
            portal = next((p for p in maps[id]["portals"] if p["x"] == nx and p["y"] == ny), None)
            if portal:
                queue.append((portal["to"], portal["arrival"]))
                continue
            if dy == -1 and rows[y][x] == "U" or dy == 1 and 0 <= ny < len(rows) and 0 <= nx < len(rows[0]) and rows[ny][nx] == "U":
                continue
            hops = {"0": ">", "1": "<", "2": "^", "3": "v", "4": ">v", "5": "<v", "6": ">^", "7": "<^"}
            if ledge in hops.get(rows[y][x], ""):
                nx, ny = nx + dx, ny + dy
            if 0 <= ny < len(rows) and 0 <= nx < len(rows[0]) and rows[ny][nx] == ledge:
                nx, ny = nx + dx, ny + dy
            if walkable(id, nx, ny):
                queue.append((id, {"x": nx, "y": ny}))
    for id, metadata in maps.items():
        metadata["rows"] = ["".join(tile if tile in "><^v" or (id, x, y) in seen else "#" for x, tile in enumerate(row)) for y, row in enumerate(metadata["rows"])]
        metadata["portals"] = [p for p in metadata["portals"] if any((id, p["x"] - dx, p["y"] - dy) in seen for dx, dy, _ in directions)]
        safe = [(x, y) for y, row in enumerate(metadata["rows"]) for x, tile in enumerate(row) if tile == "."]
        if not safe:
            raise ValueError(f"{id} has no reachable safe spawn from {origin}")
        anchor = recipes[id]["entrance"]
        start = min(safe, key=lambda p: (abs(p[0] - anchor[0]) + abs(p[1] - anchor[1]), p))
        metadata["start"] = dict(zip(("x", "y"), start))
        grass = [(x, y) for y, row in enumerate(metadata["rows"]) for x, tile in enumerate(row) if tile == "g"]
        if metadata["rustle"] is None and grass:
            metadata["rustle"] = dict(zip(("x", "y"), min(grass, key=lambda p: abs(p[0] - start[0]) + abs(p[1] - start[1]))))
        digest = lambda value: hashlib.sha256(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
        manifest.append({"file": f"{id}.png", "sha256": hashlib.sha256((output / f"{id}.png").read_bytes()).hexdigest(),
                         "recipeSha256": digest(recipes[id]), "layoutSha256": digest(metadata)})
        print(f"{id}: {len(metadata['portals'])} connections, start {metadata['start']}")
    (FEATURE / f"{region}-maps.json").write_text(json.dumps(maps, indent=2) + "\n", encoding="utf-8")
    (FEATURE / f"{region}-assets.json").write_text(json.dumps({"revision": ARCHIVES[archive][1], "assets": manifest}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("region", choices=["kanto", "hoenn", "johto", "sinnoh"])
    build(parser.parse_args().region)
