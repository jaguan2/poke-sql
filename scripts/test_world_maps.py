"""Cache/network-independent tests for native Gen III decoding contracts."""
import struct
import unittest

from PIL import Image
from export_world_maps import decode_blocks, visual_layers, outdoor_maps, terrain_rows
from build_safari_assets import Tileset


class WorldMapTests(unittest.TestCase):
    def test_terrain_normalization_uses_source_behavior_and_collision(self):
        attrs = {0: 0x10, 1: 0x70, 2: 2, 3: 0xFF, 4: 0x10, 5: 0}
        runtime = {"rows": ["######"]}
        self.assertEqual(terrain_rows(6, list(range(6)), [0, 0, 0, 0, 1, 0], attrs, "emerald", runtime), ["~Bg##."])
        self.assertEqual(terrain_rows(6, list(range(6)), [0, 0, 0, 0, 1, 0], attrs, "firered", runtime), ["~#g##."])
        self.assertEqual(terrain_rows(2, [0, 0], [1, 1], attrs, "emerald", {"rows": [".v"]}), [".v"])

    def test_bulk_selection_excludes_interiors_gates_and_caves(self):
        recipes = {"town": {"kind": "town"}, "route": {"kind": "route"}, "woods": {"kind": "forest"},
                   "gate": {"kind": "gate"}, "room": {"kind": "interior"}, "cave": {"kind": "cave"}}
        self.assertEqual(outdoor_maps(recipes), ["town", "route", "woods"])

    def test_map_words_preserve_collision_and_elevation_independently(self):
        packed = struct.pack("<3H", 17 | (2 << 10) | (12 << 12), 1023 | (3 << 10), 15 << 12)
        self.assertEqual(decode_blocks(packed, 3, 1), ([17, 1023, 0], [2, 3, 0], [12, 0, 15]))
        with self.assertRaises(ValueError):
            decode_blocks(packed, 2, 1)

    def test_each_source_layer_type_routes_halves_to_native_backgrounds(self):
        for archive, shift in (("firered", 29), ("emerald", 12)):
            with self.subTest(archive=archive):
                layers = visual_layers([0, 1, 2], {0: 0, 1: 1 << shift, 2: 2 << shift}, archive)
                self.assertEqual(layers, {"ground": [0, 3, 5], "details": [1, 4, 0], "foreground": [2, 0, 6]})
                with self.assertRaises(ValueError):
                    visual_layers([0], {0: 3 << shift}, archive)

    def test_palette_flip_and_half_order_survive_layer_separation(self):
        # In-memory source stand-in, without fetching copyrighted artwork.
        tiles = Tileset.__new__(Tileset)
        tiles.split = 512
        sheet = Image.new("P", (128, 8))
        sheet.putpixel((0, 0), 1)
        tiles.sheets = [sheet, None]
        tiles.palettes = [[(0, 0, 0), (200, 100, 50)]]
        # Top half flips its first quadrant horizontally and vertically.
        tiles.blocks = [struct.pack("<8H", 0, 1, 1, 1, 0xC00, 1, 1, 1), None]
        lower, upper = tiles.metatile_layer("G:0", 0), tiles.metatile_layer("G:0", 1)
        self.assertEqual(lower.getpixel((0, 0)), (200, 100, 50, 255))
        self.assertEqual(upper.getpixel((7, 7)), (200, 100, 50, 255))
        self.assertEqual(upper.getpixel((0, 0))[3], 0)
        merged = tiles.metatile("G:0")
        self.assertEqual(merged.getpixel((0, 0)), lower.getpixel((0, 0)))
        self.assertEqual(merged.getpixel((7, 7)), upper.getpixel((7, 7)))


if __name__ == "__main__":
    unittest.main()
