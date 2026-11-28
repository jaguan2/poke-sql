"""Vendor original FireRed/Platinum UI artwork; no runtime downloads."""
import hashlib
import json
import struct
from PIL import Image
from safari_sources import ROOT, ARCHIVES
from build_region_overviews import GameSource

OUTPUT = ROOT / "web/public/game-ui"
MANIFEST = ROOT / "web/src/shared/ui/native-assets.json"


def palette(game, path):
    return [tuple(map(int, line.split())) for line in game.text(path).splitlines()[3:] if line.strip()]


def render_tiles(sheet, entries, colors, width, height, palette_offset=0, transparent=False):
    canvas = Image.new("RGBA", (width, height))
    columns = sheet.width // 8
    for index, entry in enumerate(entries):
        tile, bank = entry & 1023, entry >> 12
        if bank < palette_offset:
            continue
        pixels = sheet.crop((tile % columns * 8, tile // columns * 8, tile % columns * 8 + 8, tile // columns * 8 + 8))
        rgba = Image.new("RGBA", (8, 8))
        indices = [15 - pixel // 17 if sheet.mode == "L" else pixel % 16 for pixel in pixels.getdata()]
        rgba.putdata([colors[(bank - palette_offset) * 16 + pixel] + (0 if transparent and pixel == 0 else 255,) for pixel in indices])
        if entry & 0x400: rgba = rgba.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if entry & 0x800: rgba = rgba.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        canvas.alpha_composite(rgba, (index % (width // 8) * 8, index // (width // 8) * 8))
    return canvas


def platinum_town_map(game):
    base = "res/graphics/town_map/"
    sheet = Image.open(game.file(base + "bottom_screen_map_tiles.png"))
    raw = game.file(base + "bottom_screen_region_map_tilemap.NSCR").read_bytes()
    if raw[:4] != b"RCSN" or raw[16:20] != b"NRCS":
        raise ValueError("Unsupported Platinum town map screen")
    width, height = struct.unpack_from("<HH", raw, 24)
    size = struct.unpack_from("<I", raw, 32)[0]
    if size != width * height // 32 or len(raw) != size + 36:
        raise ValueError("Unexpected Platinum screen dimensions")
    def entries(data):
        native = struct.unpack(f"<{size // 2}H", data[36:])
        return [native[(y // 32 * (width // 256) + x // 32) * 1024 + y % 32 * 32 + x % 32] for y in range(height // 8) for x in range(width // 8)]
    colors = palette(game, base + "bottom_screen_map.pal")
    background = game.file(base + "bottom_screen_region_bg_tilemap.NSCR").read_bytes()
    if background[:36] != raw[:36]:
        raise ValueError("Platinum town map layers have different formats")
    image = render_tiles(sheet, entries(background), colors, width, height)
    image.alpha_composite(render_tiles(sheet, entries(raw), colors, width, height, transparent=True))
    return image


def sinnoh_overview(recipes, routes, output):
    game = GameSource("platinum")
    image = platinum_town_map(game)
    data = json.loads(game.text("res/town_map/town_map_data.json"))
    points = {}
    for id in routes:
        # Platinum's source data spells Eterna City's area "eternia_city".
        key = {"mt-coronet": "mount_coronet", "eterna-city": "eternia_city"}.get(id, id.replace("-", "_"))
        cells = [b for b in data["blocks"] if b.get("area") == key or b.get("landmark") == key]
        if not cells:
            cells = [b for b in data["blocks"] if str(b.get("area", "")).startswith(key + "_")]
        if not cells:
            raise ValueError(f"No native Platinum town-map anchor for {id}")
        points[id] = {"x": round(sum(b["x"] for b in cells) / len(cells) * 16 + 8), "y": round(sum(b["z"] for b in cells) / len(cells) * 16 + 8)}
    path = output / "region-map.png"
    output.mkdir(parents=True, exist_ok=True)
    image.save(path)
    digest = lambda value: hashlib.sha256(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    return {"file": "sinnoh/region-map.png", "game": "Pokémon Platinum", "width": image.width, "height": image.height,
            "points": points, "markers": [id for id, route in recipes.items() if route["kind"] in {"town", "forest", "lake", "snow"} or id == "mt-coronet"],
            "recipeSha256": digest(routes), "pointsSha256": digest(points), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "revision": ARCHIVES["platinum"][1], "sources": game.files}


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    games = {archive: GameSource(archive) for archive in ["firered", "platinum"]}
    assets = []
    def save(name, image):
        image.save(OUTPUT / name)
        assets.append({"file": "game-ui/" + name, "width": image.width, "height": image.height, "sha256": hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest()})
    fr, pt = games["firered"], games["platinum"]
    sheet = Image.open(pt.file("res/graphics/start_menu/icons.png"))
    # Ten 32x32 cells; the trailing nine rows are palette-editor metadata.
    for name, frame in {"pokedex": 0, "pokemon": 1, "trainer": 3, "options": 5}.items():
        image = sheet.crop((0, frame * 32, 32, (frame + 1) * 32)).convert("RGBA")
        alpha = Image.new("L", (32, 32))
        alpha.putdata([0 if pixel == 0 else 255 for pixel in sheet.crop((0, frame * 32, 32, (frame + 1) * 32)).getdata()])
        image.putalpha(alpha)
        save(f"{name}.png", image)
    badges = Image.open(fr.file("graphics/trainer_card/badges.png"))
    for i in range(8):
        badge = badges.crop((i * 16, 0, (i + 1) * 16, 16))
        rgba = badge.convert("RGBA")
        alpha = Image.new("L", badge.size)
        alpha.putdata([0 if pixel == 0 else 255 for pixel in badge.getdata()])
        rgba.putalpha(alpha)
        save(f"badge-{i + 1}.png", rgba)
    card = Image.open(fr.file("graphics/trainer_card/tiles.png")).convert("RGBA")
    raw = fr.file("graphics/trainer_card/bg.bin").read_bytes()
    if len(raw) != 1200: raise ValueError("Unexpected native Trainer Card background")
    background = Image.new("RGBA", (240, 160))
    for i, entry in enumerate(struct.unpack("<600H", raw)):
        tile = entry & 1023
        image = card.crop((tile % 16 * 8, tile // 16 * 8, tile % 16 * 8 + 8, tile // 16 * 8 + 8))
        if entry & 0x400: image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if entry & 0x800: image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        background.paste(image, (i % 30 * 8, i // 30 * 8))
    save("trainer-card.png", background)
    town = Image.open(fr.file("graphics/items/icons/town_map.png"))
    town = town.convert("RGBA")
    save("town-map.png", town)
    frame = Image.open(fr.file("graphics/text_window/std.png"))
    colors = palette(fr, "graphics/text_window/stdpal_0.pal")
    rgba = Image.new("RGBA", frame.size)
    rgba.putdata([colors[p] + (0 if p == 0 else 255,) for p in frame.getdata()])
    save("window.png", rgba)
    for name, native in {"forest": "forest", "coast": "beach", "cave": "cave", "city": "city"}.items():
        base = f"graphics/pokemon_storage/wallpapers/{native}/"
        tiles = Image.open(fr.file(base + "tiles.png"))
        colors = [tuple(tiles.getpalette()[i:i + 3]) for i in range(0, len(tiles.getpalette()), 3)]
        raw = fr.file(base + "tilemap.bin").read_bytes()
        if len(raw) != 720: raise ValueError("Unexpected FireRed PC wallpaper size")
        save(f"pc-{name}.png", render_tiles(tiles, struct.unpack("<360H", raw), colors, 160, 144, palette_offset=1))
    recipes = json.loads((ROOT / "scripts/sinnoh_routes.json").read_text(encoding="utf-8"))
    routes = json.loads((ROOT / "web/src/features/safari/sinnoh-routes.json").read_text(encoding="utf-8"))
    overview = sinnoh_overview(recipes, routes, ROOT / "web/public/safari/sinnoh")
    pt.files.update(overview["sources"])
    (ROOT / "web/src/features/safari/sinnoh-overview.json").write_text(json.dumps(overview, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps({"revisions": {a: ARCHIVES[a][1] for a in games}, "sources": {a: g.files for a, g in games.items()}, "assets": assets}, indent=2) + "\n", encoding="utf-8")
    print(f"Vendored {len(assets)} original game UI assets.")


if __name__ == "__main__":
    build()
