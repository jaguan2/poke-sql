"""Original pixel buildings and street furniture for authored region maps."""
from math import cos, pi, sin

TILE = 16


def footprint(building):
    if isinstance(building, list):
        x, y = building
        return x, y, 5, 5
    return building["x"], building["y"], building["width"], building["height"]


def draw_building(draw, building):
    x, y, width, height = footprint(building)
    x, y, width, height = x * TILE, y * TILE, width * TILE, height * TILE
    roof = building.get("roof", "#526d8c")
    wall = building.get("wall", "#e4d8ba")
    style = building.get("style", "home")
    right, bottom = x + width - 1, y + height - 1
    draw.rectangle((x + 3, y + 5, right, bottom), fill="#45565a")
    draw.rectangle((x, y + 3, right - 4, bottom - 3), fill=wall, outline="#3b494d", width=2)
    roof_height = height // 3
    draw.polygon([(x - 1, y + roof_height), (x + 8, y), (right - 12, y),
                  (right - 3, y + roof_height)], fill=roof, outline="#344349")
    for line in range(y + 5, y + roof_height, 5):
        draw.line((x + 7, line, right - 12, line), fill="#ffffff35", width=1)
    for wy in range(y + roof_height + 7, bottom - 18, 14):
        for wx in range(x + 8, right - 11, 14):
            draw.rectangle((wx, wy, wx + 7, wy + 8), fill="#496d83", outline="#354c5b")
            draw.line((wx + 1, wy + 1, wx + 6, wy + 1), fill="#c4e3df")
    door_x = x + width // 2 - 7
    draw.rectangle((door_x, bottom - 19, door_x + 12, bottom - 4), fill="#354957", outline="#243c43")
    draw.line((door_x + 6, bottom - 18, door_x + 6, bottom - 5), fill="#b9caca")
    if style == "warehouse":
        draw.rectangle((x + 8, bottom - 24, right - 12, bottom - 5), fill="#707b7d", outline="#3b494d")
        for line in range(bottom - 22, bottom - 5, 4):
            draw.line((x + 9, line, right - 13, line), fill="#a2aaa4")
    if style in {"lab", "museum", "station", "center"}:
        draw.rectangle((x + 7, y + roof_height + 2, right - 11, y + roof_height + 12), fill="#f0ead7", outline="#43575b")
        label = {"lab": "LAB", "museum": "MUSEUM", "station": "STATION", "center": "PC"}[style]
        draw.text((x + 12, y + roof_height + 3), label, fill="#344c5a")
    if style == "cafe":
        for offset in range(5, width - 8, 8):
            draw.rectangle((x + offset, bottom - 27, x + offset + 6, bottom - 19), fill="#a54c50" if offset % 16 < 8 else "#f3e5bb")


def draw_landmark(draw, landmark):
    x, y, width, height = footprint(landmark)
    x, y, width, height = x * TILE, y * TILE, width * TILE, height * TILE
    style = landmark["style"]
    right, bottom = x + width - 1, y + height - 1
    if style == "fountain":
        draw.ellipse((x, y + 5, right, bottom), fill="#b4c7c6", outline="#55737b", width=2)
        draw.ellipse((x + 4, y + 9, right - 4, bottom - 4), fill="#579fb8", outline="#c5edee")
        cx = x + width // 2
        draw.line((cx, bottom - 8, cx, y + 5), fill="#d5f1ee", width=3)
        draw.arc((x + 7, y + 2, right - 7, bottom - 9), 185, 355, fill="#e5ffff", width=2)
    elif style == "wheel":
        cx, cy = x + width // 2, y + height // 2 - 6
        radius = min(width, height) // 2 - 8
        draw.polygon([(cx, cy), (cx - 14, bottom), (cx + 14, bottom)], fill="#98b9b4", outline="#405e66")
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline="#e2c56a", width=4)
        for index in range(8):
            angle = index * pi / 4
            tx, ty = cx + int(cos(angle) * radius), cy + int(sin(angle) * radius)
            draw.line((cx, cy, tx, ty), fill="#e0dfc7", width=2)
            draw.rounded_rectangle((tx - 5, ty - 3, tx + 5, ty + 7), radius=2,
                                   fill=("#bb586c", "#53a6b4", "#d6a947", "#9a79b6")[index % 4], outline="#3d5360")
    elif style == "ruin":
        draw.rectangle((x + 3, y + 5, right - 3, bottom - 3), fill="#9c927d", outline="#595d56", width=2)
        for px in range(x + 8, right - 7, 18):
            draw.rectangle((px, y, px + 9, bottom - 6), fill="#c3bda4", outline="#6e756b")
        draw.line((x + 3, bottom - 1, right - 3, bottom - 1), fill="#d7d2b4", width=3)
    elif style == "construction":
        draw.rectangle((x + 3, y + 5, right - 3, bottom - 3), fill="#b09c77", outline="#5c635b", width=2)
        for px in range(x + 5, right - 3, 12):
            draw.line((px, bottom - 4, px, y + 2), fill="#636f71", width=3)
        draw.line((x + 5, y + 3, right - 4, y + 3), fill="#c1ccbf", width=3)
        draw.line((x + 3, bottom - 3, right - 3, bottom - 3), fill="#e8bd60", width=4)
