"""Remaining authored street furniture and shared footprints for region maps."""
from math import cos, pi, sin

TILE = 16


def footprint(building):
    if isinstance(building, list):
        x, y = building
        return x, y, 5, 5
    return building["x"], building["y"], building["width"], building["height"]


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
