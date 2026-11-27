"""Export existing Gen III journeys to Tiled + provenance/geometry metadata.

python scripts/export_world_maps.py all
python scripts/export_world_maps.py kanto [pallet-town route-1 viridian-city]
Requires Pillow. --source-root uses local pret files without network access.
This visual prototype does not change Safari's movement maps or saved sessions.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

from PIL import Image
from build_safari_assets import Tileset
from build_region_assets import snake
from safari_sources import ROOT, ARCHIVES, source

FEATURE = ROOT / "web/src/features/safari"
PUBLIC = ROOT / "web/public/safari"
MANIFEST = FEATURE / "world-assets.json"
GENERATORS = ["export_world_maps.py", "build_safari_assets.py", "build_region_assets.py"]
REGIONS = ("kanto", "hoenn")
OUTDOOR_KINDS = {"town", "route", "forest"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_digest(value):
    return digest(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode())


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def decode_blocks(data, width, height):
    if len(data) != width * height * 2:
        raise ValueError("Map block data does not match its dimensions")
    words = struct.unpack(f"<{width * height}H", data)
    return ([word & 0x3FF for word in words], [(word >> 10) & 3 for word in words],
            [word >> 12 for word in words])


def visual_layers(numbers, attributes, archive):
    layers = {name: [] for name in ("ground", "details", "foreground")}
    for number in numbers:
        attr = attributes[number]
        layer_type = (attr >> 29) & 3 if archive == "firered" else attr >> 12
        if layer_type not in (0, 1, 2):
            raise ValueError(f"Unsupported {archive} layer type {layer_type} at metatile {number}")
        lower, upper = number * 2 + 1, number * 2 + 2
        # Source NORMAL => middle/top; COVERED => bottom/middle; SPLIT => bottom/top.
        layers["ground"].append(lower if layer_type in (1, 2) else 0)
        layers["details"].append(upper if layer_type == 1 else lower if layer_type == 0 else 0)
        layers["foreground"].append(upper if layer_type in (0, 2) else 0)
    return layers


def properties(values):
    return [{"name": key, "type": "int" if isinstance(value, int) else "string", "value": value}
            for key, value in values.items()]


def outdoor_maps(recipes):
    return [id for id, recipe in recipes.items() if recipe["kind"] in OUTDOOR_KINDS]


def verify_render(id, region, width, height, numbers, layers, halves, tiles):
    """Validate all pixels before publishing this map's generated assets."""
    with Image.open(PUBLIC / region / f"{id}.png") as original:
        legacy = original.convert("RGBA")
    if legacy.size != (width * 16, height * 16):
        raise ValueError(f"{id}: existing render dimensions differ")
    for cell, number in enumerate(numbers):
        flattened = Image.new("RGBA", (16, 16), tiles.palettes[0][0] + (255,))
        for name in layers:
            gid = layers[name][cell]
            if gid:
                flattened.alpha_composite(halves[number][(gid - 1) % 2])
        x, y = cell % width * 16, cell // width * 16
        if flattened.tobytes() != legacy.crop((x, y, x + 16, y + 16)).tobytes():
            raise ValueError(f"{id}: layers differ from shipped render at cell {cell}")


def export(region, ids=None, source_root=None):
    archive = "firered" if region == "kanto" else "emerald"
    recipes = json.loads((FEATURE / f"{region}-routes.json").read_text(encoding="utf-8"))
    runtime_maps = json.loads((FEATURE / f"{region}-maps.json").read_text(encoding="utf-8"))
    ids = outdoor_maps(recipes) if ids is None else ids
    for id in ids:
        if id not in recipes:
            raise ValueError(f"Unknown {region} map: {id}")
        if recipes[id]["kind"] not in OUTDOOR_KINDS:
            raise ValueError(f"{id}: only outdoor towns, routes and forests are exported")
    output = PUBLIC / "worlds" / region
    output.mkdir(parents=True, exist_ok=True)
    inputs = {}

    def load(path):
        file = source_root / path if source_root else source(path, archive)
        inputs[path] = digest(file.read_bytes())
        return file

    def read(path):
        return json.loads(load(path).read_text(encoding="utf-8"))

    layouts = {entry["id"]: entry for entry in read("data/layouts/layouts.json")["layouts"] if "id" in entry}
    # Native identifiers are not derived from runtime slugs (Route1 != ROUTE_1).
    native_ids = {read(f"data/maps/{recipe['native']}/map.json")["id"]: id for id, recipe in recipes.items()}
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"version": 1, "maps": {}, "assets": {}}
    generators = {name: digest((ROOT / "scripts" / name).read_text(encoding="utf-8").encode()) for name in GENERATORS}
    for id in ids:
        inputs.clear()
        inputs["data/layouts/layouts.json"] = digest(load("data/layouts/layouts.json").read_bytes())
        recipe, runtime = recipes[id], runtime_maps[id]
        data = read(f"data/maps/{recipe['native']}/map.json")
        layout = layouts[data["layout"]]
        width, height = layout["width"], layout["height"]
        if (width, height) != (len(runtime["rows"][0]), len(runtime["rows"])):
            raise ValueError(f"{id}: native and runtime map dimensions differ")
        tiles = Tileset(snake(layout["secondary_tileset"]), archive, snake(layout["primary_tileset"]), loader=load)
        numbers, collision, elevation = decode_blocks(load(layout["blockdata_filepath"]).read_bytes(), width, height)
        attrs, halves = {}, {}
        for number in sorted(set(numbers)):
            bank, index = (1, number - tiles.split) if number >= tiles.split else (0, number)
            attr_size, fmt = (4, "<I") if archive == "firered" else (2, "<H")
            attrs[number] = struct.unpack_from(fmt, tiles.attributes[bank], index * attr_size)[0]
            reference = f"{'S' if bank else 'G'}:{index}"
            halves[number] = [tiles.metatile_layer(reference, layer) for layer in (0, 1)]
        layers = visual_layers(numbers, attrs, archive)
        verify_render(id, region, width, height, numbers, layers, halves, tiles)
        # Keep native IDs stable, including unused atlas slots; paired halves can
        # be edited/replaced independently without changing map topology.
        count, columns = (max(numbers) + 1) * 2, 16
        atlas = Image.new("RGBA", (columns * 16, ((count + columns - 1) // columns) * 16))
        for number, images in halves.items():
            for half, image in enumerate(images):
                index = number * 2 + half
                atlas.alpha_composite(image, (index % columns * 16, index // columns * 16))
        atlas_name = f"{id}-tiles.png"
        atlas.save(output / atlas_name, optimize=True)
        tiled_layers = [{"id": index + 1, "name": name, "type": "tilelayer", "width": width,
                         "height": height, "x": 0, "y": 0, "opacity": 1, "visible": True, "data": gids}
                        for index, (name, gids) in enumerate(layers.items())]
        objects = []
        for kind, events in (("warp", data["warp_events"]), ("npc", data["object_events"])):
            for event in events:
                objects.append({"id": len(objects) + 1, "name": str(event.get("local_id", len(objects))),
                                "type": kind, "point": True, "x": event["x"] * 16, "y": event["y"] * 16,
                                "properties": properties({"sourceEvent": json.dumps(event, separators=(",", ":"))})})
        tiled_layers.append({"id": 4, "name": "source-events", "type": "objectgroup", "x": 0, "y": 0,
                             "opacity": 1, "visible": False, "draworder": "topdown", "objects": objects})
        tilemap = {"type": "map", "version": "1.10", "orientation": "orthogonal", "renderorder": "right-down",
                   "infinite": False, "width": width, "height": height, "tilewidth": 16, "tileheight": 16,
                   "backgroundcolor": "#%02x%02x%02x" % tiles.palettes[0][0], "nextlayerid": 5,
                   "nextobjectid": len(objects) + 1, "layers": tiled_layers,
                   "properties": properties({"worldFormatVersion": 1, "worldId": f"{region}.{id}"}),
                   "tilesets": [{"firstgid": 1, "name": f"{archive}-{id}", "image": atlas_name,
                                 "imagewidth": atlas.width, "imageheight": atlas.height, "columns": columns,
                                 "tilewidth": 16, "tileheight": 16, "tilecount": count, "margin": 0, "spacing": 0}]}
        tilemap_name, metadata_name = f"{id}.tmj", f"{id}.world.json"
        write_json(output / tilemap_name, tilemap)
        border = load(layout["border_filepath"]).read_bytes()
        metadata = {"formatVersion": 1, "id": f"{region}.{id}", "runtimeId": id, "region": region,
                    "name": recipe["name"], "sourceGeneration": 3, "width": width, "height": height,
                    "tileSize": 16, "visualTileSize": 16, "tilemap": tilemap_name,
                    "spawnPoints": {"default": runtime["start"]}, "movementRows": runtime["rows"],
                    "cells": {"metatile": numbers, "collision": collision, "elevation": elevation,
                              "behavior": [attrs[n] & (0x1FF if archive == "firered" else 0xFF) for n in numbers]},
                    "connections": [{**connection, "runtimeDestination": native_ids.get(connection["map"])}
                                    for connection in data["connections"] or []],
                    "transitions": runtime["portals"], "warps": data["warp_events"],
                    "objects": data["object_events"], "interactions": data.get("bg_events", []),
                    "triggers": data.get("coord_events", []),
                    "border": {"width": layout.get("border_width", 2), "height": layout.get("border_height", 2),
                               "blocks": list(struct.unpack(f"<{len(border) // 2}H", border))},
                    "weather": data["weather"], "lighting": "source-default",
                    "camera": {"bounds": "map"}, "runtimeLayoutSha256": json_digest(runtime),
                    "recipeSha256": json_digest(recipe), "generators": generators,
                    "source": {"repository": f"https://github.com/pret/{ARCHIVES[archive][0]}",
                               "revision": None if source_root else ARCHIVES[archive][1], "files": dict(inputs),
                               "assetCategory": "original-game-data", "redistributionLicense": "not-established"}}
        write_json(output / metadata_name, metadata)
        prefix = f"worlds/{region}/"
        manifest["maps"][id] = {"region": region, "width": width, "height": height,
                                "tilemap": prefix + tilemap_name, "metadata": prefix + metadata_name}
        for name in (atlas_name, tilemap_name, metadata_name):
            file = output / name
            manifest["assets"][prefix + name] = digest(file.read_bytes() if name.endswith(".png") else file.read_text(encoding="utf-8").encode())
        print(f"{id}: {width}x{height}, {len(halves)} metatiles, {len(objects)} source events; pixels match shipped art", flush=True)
        # functools caches on instance methods otherwise retain every decoded
        # tileset instance during a region-wide export.
        tiles.metatile.cache_clear()
        tiles.metatile_layer.cache_clear()
    manifest["generators"] = generators
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("region", choices=[*REGIONS, "all"])
    parser.add_argument("maps", nargs="*")
    parser.add_argument("--source-root", type=Path, help="Local pret source tree; never fetches missing files")
    args = parser.parse_args()
    if args.region == "all" and (args.maps or args.source_root):
        parser.error("Use a single region with explicit maps or --source-root")
    for region in REGIONS if args.region == "all" else [args.region]:
        export(region, args.maps or None, args.source_root)
