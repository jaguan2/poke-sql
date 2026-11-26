"""Build original PokéSQL Sinnoh layouts with tiles from the bundled region art."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web" / "public" / "safari"
FEATURE = ROOT / "web" / "src" / "features" / "safari"
TILE = 16
BLOCKED = {"border", "trees", "water", "building", "turbine"}
LAYOUT_TILES = {**dict.fromkeys(BLOCKED, "#"), "encounters": "g", "ice": "i"}


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_art(image, path):
    image.save(path, optimize=True)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def position(x, y):
    return {"x": x, "y": y}


def gate(width, height, side, outside=False):
    return {
        "north": (width // 2, -1 if outside else 0),
        "south": (width // 2, height if outside else height - 1),
        "west": (-1 if outside else 0, height // 2),
        "east": (width if outside else width - 1, height // 2),
    }[side]


def make_layout(route_id, route, recipes):
    width, height = route.get("size", [24, 18])
    center = (width // 2, height // 2)
    plan = [["ground"] * width for _ in range(height)]

    def paint(terrain, x1, y1, x2, y2):
        if not (0 <= x1 <= x2 < width and 0 <= y1 <= y2 < height):
            raise ValueError(f"{route_id} has an out-of-bounds {terrain} rectangle")
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                plan[y][x] = terrain

    for edge in [(0, 0, width - 1, 1), (0, height - 2, width - 1, height - 1),
                 (0, 0, 1, height - 1), (width - 2, 0, width - 1, height - 1)]:
        paint("border", *edge)
    for terrain in ("encounters", "trees", "water", "flowers", "ice"):
        for rect in route.get(terrain, []):
            paint(terrain, *rect)
    for rect in route.get("paths", []):
        paint("path", *rect)

    portals = []
    for side, destination in route["exits"].items():
        target = recipes[destination]
        back, = (side for side, node in target["exits"].items() if node == route_id)
        arrival = gate(*target.get("size", [24, 18]), back)
        x, y = gate(width, height, side)
        cx, cy = center
        if side in ("north", "south"):
            paint("path", x - 1, min(y, cy), x + 1, max(y, cy))
        else:
            paint("path", min(x, cx), y - 1, max(x, cx), y + 1)
        portals.append({**position(*gate(width, height, side, outside=True)), "to": destination,
                        "arrival": position(*arrival)})

    for x, y in route.get("buildings", []):
        paint("building", x, y, x + 4, y + 4)
    for x, y in route.get("turbines", []):
        paint("turbine", x - 1, y - 2, x + 1, y + 1)

    rows = ["".join(LAYOUT_TILES.get(cell, ".") for cell in row) for row in plan]
    if tree := route.get("honeyTree"):
        x, y = tree["x"], tree["y"]
        if not (0 <= x < width - 1 and 0 <= y < height - 1 and
                all(plan[ty][tx] in {"border", "trees"} for ty in (y, y + 1) for tx in (x, x + 1))):
            raise ValueError(f"{route_id} Honey Tree must fit on existing trees")
    patches = [(x, y) for y, row in enumerate(rows) for x, cell in enumerate(row) if cell == "g"]
    if bool(patches) != bool(route["pool"]) or rows[center[1]][center[0]] != ".":
        raise ValueError(f"{route_id} needs a safe spawn and encounter tiles matching its pool")
    closest = min(patches, key=lambda p: abs(p[0] - center[0]) + abs(p[1] - center[1])) if patches else None
    return plan, {"rows": rows, "music": route["music"], "start": position(*center),
                  "rustle": position(*closest) if closest else None, "portals": portals}


def tile_sources():
    def crop(file, x, y, width=1, height=1):
        with Image.open(PUBLIC / f"{file}.png") as source:
            return source.crop((x * TILE, y * TILE, (x + width) * TILE, (y + height) * TILE)).convert("RGB")

    art = {
        "ground": crop("hoenn/littleroot-town", 8, 2),
        "path": crop("kanto/route-1", 12, 2),
        "flowers": crop("hoenn/littleroot-town", 5, 17),
        "grass": crop("kanto/route-1", 13, 8),
        "forest-grass": crop("hoenn/petalburg-woods", 6, 9),
        "tree": crop("hoenn/littleroot-town", 0, 0, 2, 2),
        "forest-tree": crop("hoenn/petalburg-woods", 0, 0, 2, 2),
        "house": crop("hoenn/littleroot-town", 2, 4, 5, 5),
        "cave-ground": crop("johto/union-cave-1f", 11, 10),
        "cave-wall": crop("johto/union-cave-1f", 12, 13),
        "snow-ground": crop("maps/tundra", 5, 11),
        "snow-drift": crop("maps/tundra", 5, 18),
        "snow-ice": crop("maps/tundra", 4, 14),
        "snow-wall": crop("maps/tundra", 0, 0, 2, 2),
    }
    golden = art["tree"].copy()
    golden.putdata([
        (g, (r + 3 * g) // 5, min(b, g // 3)) if g > r + 8 and g > b + 17 else (r, g, b)
        for r, g, b in art["tree"].getdata()
    ])
    art["honey-tree"] = golden
    return art


def render_layout(plan, route, art):
    kind = route["kind"]
    cave, snow, forest = kind == "cave", kind == "snow", kind == "forest"
    width, height = len(plan[0]), len(plan)
    image = Image.new("RGB", (width * TILE, height * TILE))
    draw = ImageDraw.Draw(image)
    ground = art["cave-ground" if cave else "snow-ground" if snow else "ground"]
    wall = art["cave-wall" if cave else "snow-wall" if snow else "forest-tree" if forest else "tree"]
    grass = art["cave-ground" if cave else "snow-drift" if snow else "forest-grass" if forest else "grass"]
    if cave:
        grass = Image.blend(grass, Image.new("RGB", grass.size, "#634d76"), .45)
    for y, row in enumerate(plan):
        for x, cell in enumerate(row):
            px, py = x * TILE, y * TILE
            image.paste(ground, (px, py))
            if cell in {"border", "trees"}:
                left, top = x % (wall.width // TILE) * TILE, y % (wall.height // TILE) * TILE
                image.paste(wall.crop((left, top, left + TILE, top + TILE)), (px, py))
            elif cell == "encounters":
                image.paste(grass, (px, py))
                if cave:
                    draw.line((px + 5, py + 12, px + 9, py + 12), fill="#413751")
                    draw.line((px + 6, py + 11, px + 8, py + 11), fill="#b7a3ac")
            elif cell == "ice":
                image.paste(art["snow-ice"], (px, py))
            elif cell == "flowers" and (x + y) % 2 == 0:
                image.paste(art["flowers"], (px, py))
            elif cell == "path" and not cave and not snow:
                image.paste(art["path"], (px, py))
            elif cell == "water":
                draw.rectangle((px, py, px + 15, py + 15), fill="#4b86b3" if snow else "#3c8fad")
                shift = (x + y * 3) % 5
                draw.line((px + 2 + shift, py + 5, px + 7 + shift, py + 5), fill="#8ac5db")
                draw.line((px + 8 - shift, py + 12, px + 11 - shift, py + 12), fill="#67aec8")
                for dx, dy, edge in [(0, -1, (0, 0, 15, 0)), (0, 1, (0, 15, 15, 15)),
                                     (-1, 0, (0, 0, 0, 15)), (1, 0, (15, 0, 15, 15))]:
                    if plan[y + dy][x + dx] != "water":
                        x1, y1, x2, y2 = edge
                        draw.line((px + x1, py + y1, px + x2, py + y2), fill="#d4e7d6", width=2)
    for x, y in route.get("buildings", []):
        image.paste(art["house"], (x * TILE, y * TILE))
    for x, y in route.get("turbines", []):
        px, py = x * TILE + 8, y * TILE
        draw.polygon([(px - 5, py + 24), (px - 2, py - 5), (px + 2, py - 5), (px + 5, py + 24)], fill="#e5e3da", outline="#526475")
        for blade in [[(0, -6), (-2, -25), (2, -25), (4, -9)], [(1, -8), (21, 0), (19, 4), (0, -3)], [(0, -9), (-17, 2), (-14, 6), (2, -3)]]:
            draw.polygon([(px + dx, py + dy) for dx, dy in blade], fill="#f5f2de", outline="#526475")
        draw.rectangle((px - 2, py - 9, px + 2, py - 5), fill="#a04d4e")
    if tree := route.get("honeyTree"):
        image.paste(art["honey-tree"], (tree["x"] * TILE, tree["y"] * TILE))
    return image


def build_overview(recipes, runtime_routes, output):
    width, height = 176, 152
    chart = Image.new("RGB", (width, height), "#5497c4")
    draw = ImageDraw.Draw(chart)
    coast = [(9, 85), (17, 60), (31, 44), (28, 28), (44, 16), (79, 22), (103, 9), (119, 6),
             (149, 8), (166, 26), (155, 50), (162, 75), (151, 89), (158, 112), (134, 122),
             (111, 112), (93, 118), (73, 128), (65, 143), (28, 141), (17, 123)]
    draw.polygon(coast, fill="#99bd77", outline="#e7d397", width=3)
    draw.polygon([(103, 12), (120, 7), (147, 10), (162, 25), (148, 40), (122, 34), (112, 39)], fill="#c8dfd9")
    draw.ellipse((112, 10, 135, 22), fill="#66acc5", outline="#e7f3de")
    draw.ellipse((12, 95, 32, 110), fill="#66acc5", outline="#b6d8a0")
    for x, y in [(34, 30), (39, 38), (47, 30), (50, 40), (65, 32), (70, 39), (74, 30), (31, 56), (28, 65), (22, 74)]:
        draw.polygon([(x, y - 5), (x - 4, y + 3), (x + 4, y + 3)], fill="#437f5d")
    for x, y in [(120, 45), (141, 53), (123, 61), (136, 70), (143, 85), (116, 79)]:
        draw.polygon([(x, y - 8), (x - 7, y + 5), (x + 7, y + 5)], fill="#8d8990", outline="#6d6c7d")
        draw.polygon([(x, y - 7), (x - 3, y - 2), (x + 3, y - 2)], fill="#e4ece7")
    linked = set()
    for route_id, route in recipes.items():
        for other in route["exits"].values():
            edge = tuple(sorted((route_id, other)))
            if edge not in linked:
                line = [tuple(route["point"]), tuple(recipes[other]["point"])]
                draw.line(line, fill="#667e56", width=5)
                draw.line(line, fill="#f3df9d", width=3)
                linked.add(edge)
    points = {id: position(*route["point"]) for id, route in recipes.items()}
    for point in points.values():
        x, y = point["x"], point["y"]
        draw.rectangle((x - 2, y - 2, x + 2, y + 2), fill="#f5e7b9", outline="#435753")
    return {"file": "sinnoh/region-map.png", "game": "PokéSQL", "width": width, "height": height,
            "points": points, "markers": [id for id, route in recipes.items() if route["kind"] in {"town", "forest", "lake", "snow"} or id == "mt-coronet"],
            "recipeSha256": digest(runtime_routes), "pointsSha256": digest(points),
            "sha256": save_art(chart, output / "region-map.png")}


def build():
    recipes = json.loads(Path(__file__).with_name("sinnoh_routes.json").read_text(encoding="utf-8"))
    output = PUBLIC / "sinnoh"
    output.mkdir(parents=True, exist_ok=True)
    maps, routes, trainers, assets = {}, {}, {}, []
    art = tile_sources()
    for id, route in recipes.items():
        plan, maps[id] = make_layout(id, route, recipes)
        if "trainer" in route:
            x, y, kind = route["trainer"]
            trainers[id] = [{**position(x, y), "kind": kind, "facing": "down"}]
        else:
            trainers[id] = []
        routes[id] = {key: route[key] for key in ("name", "kind", "description", "pool")}
        if "honeyTree" in route:
            routes[id]["honeyTree"] = route["honeyTree"]
        file = f"{id}.png"
        assets.append({"file": file, "recipeSha256": digest(routes[id]), "layoutSha256": digest(maps[id]),
                       "sha256": save_art(render_layout(plan, route, art), output / file)})
    write_json(FEATURE / "sinnoh-maps.json", maps)
    write_json(FEATURE / "sinnoh-routes.json", routes)
    write_json(FEATURE / "sinnoh-trainers.json", trainers)
    write_json(FEATURE / "sinnoh-assets.json", {"sourceSha256": digest(recipes), "assets": assets})
    write_json(FEATURE / "sinnoh-overview.json", build_overview(recipes, routes, output))


if __name__ == "__main__":
    build()
