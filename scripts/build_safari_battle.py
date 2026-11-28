"""Build game-pixel battle scenery, lettering, trainer art and sprite geometry."""
import ast
import hashlib
import re
import sqlite3
import struct
from functools import partial

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image, ImageDraw

from safari_sources import ROOT, source
from build_trainers import build_trainers

firered = partial(source, archive="firered")


def palette(path):
    return [tuple(map(int, line.split())) for line in path.read_text().splitlines()[3:] if line.strip()]


def tilemap(sheet, entries, colors, palette_offset=0):
    image = Image.new("RGBA", (240, 160))
    columns = sheet.width // 8
    for y in range(20):
        for x in range(30):
            entry = entries[y * 32 + x]
            number, bank = entry & 0x3FF, entry >> 12
            tile = sheet.crop((number % columns * 8, number // columns * 8,
                               number % columns * 8 + 8, number // columns * 8 + 8))
            rgba = Image.new("RGBA", (8, 8))
            rgba.putdata([colors[(bank - palette_offset) * 16 + value] + (255,)
                          if value and bank >= palette_offset else (0, 0, 0, 0) for value in tile.getdata()])
            if entry & 0x400:
                rgba = rgba.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if entry & 0x800:
                rgba = rgba.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            image.alpha_composite(rgba, (x * 8, y * 8))
    return image


def build_background(terrain, target):
    base = f"graphics/battle_terrain/{terrain}/terrain"
    sheet = Image.open(firered(base + ".png"))
    entries = struct.unpack("<2048H", firered(base + ".bin").read_bytes())
    colors = palette(firered(base + ".pal"))
    image = tilemap(sheet, entries, colors, 2)
    image.save(target)


def build_dialogue(target):
    base = "graphics/battle_interface/textbox"
    sheet = Image.open(firered(base + ".png"))
    entries = struct.unpack("<2048H", firered(base + ".bin").read_bytes())
    colors = palette(firered(base + "1.pal")) + palette(firered(base + "2.pal"))
    tilemap(sheet, entries, colors).crop((0, 112, 240, 160)).save(target)


def build_nameplate(target):
    sheet = Image.open(firered("graphics/battle_interface/healthbox_singles_opponent.png"))
    colors = palette(firered("graphics/battle_interface/healthbox.pal"))
    image = Image.new("RGBA", (128, 32))
    # Two 64x32 OAM objects, stored as a row-major 128x32 tile sheet.
    for index in range(64):
        tile = sheet.crop((index % 16 * 8, index // 16 * 8, index % 16 * 8 + 8, index // 16 * 8 + 8))
        rgba = Image.new("RGBA", (8, 8))
        rgba.putdata([colors[value] + (255 if value else 0,) for value in tile.getdata()])
        image.alpha_composite(rgba, ((index // 32) * 64 + index % 8 * 8, index % 32 // 8 * 8))
    image = image.crop((0, 0, 104, 32))
    # Clear the baked-in level label; the renderer supplies scalable level text.
    ImageDraw.Draw(image).rectangle((56, 8, 66, 15), fill=colors[2] + (255,))
    extended = Image.new("RGBA", (112, 32))
    extended.alpha_composite(image.crop((0, 0, 48, 32)))
    extended.alpha_composite(image.crop((48, 0, 49, 32)).resize((8, 32), Image.Resampling.NEAREST), (48, 0))
    extended.alpha_composite(image.crop((48, 0, 104, 32)), (56, 0))
    extended.save(target)


def build_font(target):
    sheet = Image.open(firered("graphics/fonts/latin_normal.png"))
    text = firered("src/text.c").read_text(encoding="utf-8")
    widths = list(map(int, re.findall(r"\d+", re.search(r"sFontNormalLatinGlyphWidths\[\]\s*=\s*\{([^}]+)\}", text).group(1))))
    characters = {}
    for line in firered("charmap.txt").read_text(encoding="utf-8").splitlines():
        match = re.match(r"('(?:\\['\\]|[^'\\])')\s*=\s*([A-F0-9]{2})(?:\s|$)", line)
        if match:
            character = ast.literal_eval(match.group(1))
            if len(character) == 1 and character.isprintable():
                characters[character] = int(match.group(2), 16)
    glyphs, metrics, cmap = {}, {}, {}
    glyphs[".notdef"] = TTGlyphPen(None).glyph()
    metrics[".notdef"] = (6, 0)
    for character, code in sorted(characters.items()):
        name = f"uni{ord(character):04X}"
        pen = TTGlyphPen(None)
        for y in range(14):
            for x in range(widths[code]):
                if sheet.getpixel((code % 16 * 16 + x, code // 16 * 16 + y)) == 1:
                    pen.moveTo((x, 12 - y)); pen.lineTo((x + 1, 12 - y))
                    pen.lineTo((x + 1, 11 - y)); pen.lineTo((x, 11 - y)); pen.closePath()
        glyphs[name], metrics[name], cmap[ord(character)] = pen.glyph(), (widths[code], 0), name
    font = FontBuilder(16, isTTF=True)
    font.setupGlyphOrder(list(glyphs)); font.setupCharacterMap(cmap); font.setupGlyf(glyphs)
    font.setupHorizontalMetrics(metrics); font.setupHorizontalHeader(ascent=12, descent=-4)
    font.setupOS2(sTypoAscender=12, sTypoDescender=-4, usWinAscent=12, usWinDescent=4)
    font.setupNameTable({"familyName": "PokeSQL Battle", "styleName": "Regular", "uniqueFontIdentifier": "PokeSQL-Battle-FireRed", "fullName": "PokeSQL Battle", "psName": "PokeSQLBattle"})
    font.setupPost(); font.setupMaxp()
    font.font.recalcTimestamp = False
    font.font["head"].created = font.font["head"].modified = 3786912000
    font.font.flavor = "woff2"
    font.save(target)


def build_battle_assets(output):
    battle = output / "battle"
    battle.mkdir(parents=True, exist_ok=True)
    generated = []
    for terrain in ("grass", "sand", "cave", "water"):
        target = f"battle/{terrain}.png"
        build_background(terrain, output / target)
        generated.append(target)
    for file, builder in [("dialogue.png", build_dialogue), ("nameplate.png", build_nameplate), ("pixel.woff2", build_font)]:
        builder(battle / file)
        generated.append("battle/" + file)
    generated.extend(build_trainers(output))
    bounds, digest = {}, hashlib.sha256()
    database = ROOT / "web/public/pokemon.sqlite"
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as db:
        ids = [row[0] for row in db.execute("SELECT id FROM pokemon ORDER BY id")]
    for pokemon_id in ids:
        file = f"{pokemon_id}.png"
        data = (ROOT / "web/public/sprites" / file).read_bytes()
        digest.update(file.encode()); digest.update(data)
        image = Image.open(ROOT / "web/public/sprites" / file).convert("RGBA")
        left, top, right, bottom = image.getbbox()
        bounds[str(pokemon_id)] = {"left": left, "top": top, "width": right - left, "height": bottom - top,
                                   "canvasWidth": image.width, "canvasHeight": image.height}
    return generated, bounds, digest.hexdigest()
