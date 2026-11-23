"""Vendor decorative trainers at original regional object-event coordinates."""
import hashlib
import json
import re
from PIL import Image
from safari_sources import ROOT, ARCHIVES, source

FEATURE = ROOT / "web/src/features/safari"
SPRITES = {
    "youngster": "youngster", "lass": "lass", "bug_catcher": "bug_catcher", "hiker": "hiker",
}
GRAPHICS = {
    "YOUNGSTER": "youngster", "BOY_1": "youngster", "BOY_2": "youngster",
    "LASS": "lass", "GIRL_1": "lass", "GIRL_2": "lass",
    "BUG_CATCHER": "bug_catcher", "HIKER": "hiker",
}


def objects(native, archive):
    if archive == "crystal":
        text = source(f"maps/{native}.asm", archive).read_text(encoding="utf-8")
        return [(int(x), int(y), sprite, movement) for x, y, sprite, movement in re.findall(
            r"\bobject_event\s+(\d+),\s*(\d+),\s*SPRITE_(\w+),\s*(\w+)", text)]
    data = json.loads(source(f"data/maps/{native}/map.json", archive).read_text(encoding="utf-8"))
    return [(event["x"], event["y"], event["graphics_id"].removeprefix("OBJ_EVENT_GFX_"), event["movement_type"])
            for event in data.get("object_events", []) if event.get("type", "object") == "object" and "graphics_id" in event]


def main():
    output = ROOT / "web/public/safari/npcs"
    output.mkdir(parents=True, exist_ok=True)
    sprites = {}
    for kind, name in SPRITES.items():
        path = f"graphics/object_events/pics/people/{name}.png"
        original = source(path, "firered")
        image = Image.open(original).convert("RGBA")
        # Native indexed sheets use palette entry zero as their transparent key.
        indexed = Image.open(original)
        if "transparency" not in indexed.info:
            image.putdata([(r, g, b, 0 if index == 0 else 255) for (r, g, b, _), index in zip(image.getdata(), indexed.getdata())])
        if image.height != 32 or image.width < 48:
            raise ValueError(f"Unexpected trainer dimensions for {path}: {image.size}")
        sheet = Image.new("RGBA", (64, 32))
        for frame in range(3):
            sheet.paste(image.crop((frame * 16, 0, (frame + 1) * 16, 32)), (frame * 16, 0))
        sheet.paste(sheet.crop((32, 0, 48, 32)).transpose(Image.Transpose.FLIP_LEFT_RIGHT), (48, 0))
        target = output / f"{kind}.png"
        sheet.save(target)
        sprites[kind] = {"file": f"npcs/{kind}.png", "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                         "source": path, "sourceSha256": hashlib.sha256(original.read_bytes()).hexdigest()}
    locations = {}
    for region, archive in [("kanto", "firered"), ("hoenn", "emerald"), ("johto", "crystal")]:
        recipes = json.loads((FEATURE / f"{region}-routes.json").read_text(encoding="utf-8"))
        maps = json.loads((FEATURE / f"{region}-maps.json").read_text(encoding="utf-8"))
        for id, recipe in recipes.items():
            layout = maps[id]
            trainers = []
            for x, y, graphic, movement in objects(recipe["native"], archive):
                kind = GRAPHICS.get(graphic)
                if not kind or not (0 <= y < len(layout["rows"]) and 0 <= x < len(layout["rows"][0])):
                    continue
                if layout["rows"][y][x] not in ".gS" or any(abs(p["x"] - x) <= 1 and abs(p["y"] - y) <= 1 for p in layout["portals"]):
                    continue
                if abs(layout["start"]["x"] - x) <= 1 and abs(layout["start"]["y"] - y) <= 1:
                    continue
                facing = next((direction.lower() for direction in ("LEFT", "RIGHT", "UP", "DOWN") if direction in movement), "down")
                if not any(p["x"] == x and p["y"] == y for p in trainers):
                    trainers.append({"x": x, "y": y, "kind": kind, "facing": facing})
            locations[id] = trainers
    manifest = {"revisions": {archive: values[1] for archive, values in ARCHIVES.items()}, "sprites": sprites, "locations": locations}
    (FEATURE / "route-trainers.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Vendored {len(sprites)} decorative trainer sheets and {sum(map(len, locations.values()))} original object positions.")


if __name__ == "__main__":
    main()
