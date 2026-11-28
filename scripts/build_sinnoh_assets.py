"""Build original PokéSQL Sinnoh layouts with tiles from the bundled region art."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from region_architecture import draw_landmark, footprint

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web" / "public" / "safari"
FEATURE = ROOT / "web" / "src" / "features" / "safari"
TILE = 16
BLOCKED = {"border", "trees", "water", "building", "turbine", "landmark"}
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
    for terrain in ("encounters", "trees", "water", "flowers", "ice", "paving", "boardwalk"):
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
        trail = [(x, y), *route.get("exitPaths", {}).get(side, []), (cx, cy)]
        for (x1, y1), (x2, y2) in zip(trail, trail[1:]):
            if x1 != x2 and y1 != y2:
                raise ValueError(f"{route_id} trails must follow cardinal directions")
            if x1 == x2:
                paint(route.get("street", "path"), x1 - 1, min(y1, y2), x1 + 1, max(y1, y2))
            else:
                paint(route.get("street", "path"), min(x1, x2), y1 - 1, max(x1, x2), y1 + 1)
        portals.append({**position(*gate(width, height, side, outside=True)), "to": destination,
                        "arrival": position(*arrival)})

    for building in route.get("buildings", []):
        x, y, w, h = footprint(building)
        paint("building", x, y, x + w - 1, y + h - 1)
    for landmark in route.get("landmarks", []):
        x, y, w, h = footprint(landmark)
        paint("landmark", x, y, x + w - 1, y + h - 1)
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
                  "revision": route.get("revision", 0),
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
        "house": crop("kanto/pallet-town", 5, 3, 5, 5),
        "center": crop("kanto/cerulean-city", 20, 15, 5, 5),
        "lab": crop("kanto/pallet-town", 13, 9, 7, 5),
        "station": crop("kanto/cerulean-city", 27, 25, 4, 4),
        "warehouse": crop("kanto/cerulean-city", 28, 17, 7, 5),
        "museum": crop("kanto/cerulean-city", 28, 17, 7, 5),
        "cafe": crop("kanto/cerulean-city", 13, 14, 7, 4),
        "paving": crop("kanto/cerulean-city", 11, 13),
        "boardwalk": crop("kanto/cerulean-city", 22, 2),
        "water": crop("hoenn/route-103", 25, 9),
        "cave-ground": crop("johto/union-cave-1f", 11, 10),
        "cave-wall": crop("johto/union-cave-1f", 12, 13),
        "snow-ground": crop("maps/tundra", 5, 11),
        "snow-drift": crop("maps/tundra", 5, 18),
        "snow-ice": crop("maps/tundra", 4, 14),
        "snow-wall": crop("maps/tundra", 0, 0, 2, 2),
    }
    # Keep native tree colors; the interaction marker identifies the Honey Tree.
    art["honey-tree"] = art["tree"]
    art["sand"] = crop("maps/desert", 5, 11)
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
    if kind == "sand":
        ground = grass = art["sand"]
    for y, row in enumerate(plan):
        for x, cell in enumerate(row):
            px, py = x * TILE, y * TILE
            image.paste(ground, (px, py))
            if cell in {"border", "trees"}:
                left, top = x % (wall.width // TILE) * TILE, y % (wall.height // TILE) * TILE
                image.paste(wall.crop((left, top, left + TILE, top + TILE)), (px, py))
            elif cell == "encounters":
                image.paste(grass, (px, py))
            elif cell == "ice":
                image.paste(art["snow-ice"], (px, py))
            elif cell == "flowers" and (x + y) % 2 == 0:
                image.paste(art["flowers"], (px, py))
            elif cell == "path" and not cave and not snow:
                image.paste(art["path"], (px, py))
            elif cell in {"paving", "boardwalk", "water"}:
                image.paste(art[cell], (px, py))
    for building in route.get("buildings", []):
        x, y, width, height = footprint(building)
        style = building.get("style", "home") if isinstance(building, dict) else "home"
        original = art.get(style, art["house"])
        image.paste(original.resize((width * TILE, height * TILE), Image.Resampling.NEAREST), (x * TILE, y * TILE))
    for landmark in route.get("landmarks", []):
        draw_landmark(draw, landmark)
    for x, y in route.get("turbines", []):
        px, py = x * TILE + 8, y * TILE
        draw.polygon([(px - 5, py + 24), (px - 2, py - 5), (px + 2, py - 5), (px + 5, py + 24)], fill="#e5e3da", outline="#526475")
        for blade in [[(0, -6), (-2, -25), (2, -25), (4, -9)], [(1, -8), (21, 0), (19, 4), (0, -3)], [(0, -9), (-17, 2), (-14, 6), (2, -3)]]:
            draw.polygon([(px + dx, py + dy) for dx, dy in blade], fill="#f5f2de", outline="#526475")
        draw.rectangle((px - 2, py - 9, px + 2, py - 5), fill="#a04d4e")
    if tree := route.get("honeyTree"):
        image.paste(art["honey-tree"], (tree["x"] * TILE, tree["y"] * TILE))
    return image


def build_overview(region, recipes, runtime_routes, output):
    from build_game_ui import sinnoh_overview
    return sinnoh_overview(recipes, runtime_routes, output)


def build(region="sinnoh"):
    if region != "sinnoh":
        raise ValueError("Only Sinnoh's authored world is supported")
    recipes = json.loads(Path(__file__).with_name(f"{region}_routes.json").read_text(encoding="utf-8"))
    output = PUBLIC / region
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
    write_json(FEATURE / f"{region}-maps.json", maps)
    write_json(FEATURE / f"{region}-routes.json", routes)
    write_json(FEATURE / f"{region}-trainers.json", trainers)
    write_json(FEATURE / f"{region}-assets.json", {"sourceSha256": digest(recipes), "assets": assets})
    write_json(FEATURE / f"{region}-overview.json", build_overview(region, recipes, routes, output))


if __name__ == "__main__":
    build()
