# Original game artwork inventory

Updated 2026-11-28 on dev. This records artwork provenance, not a claim that
PokéSQL's desktop layout or authored regions are exact copies of a game.

## Replaced custom artwork

| Surface | Original game source now used |
| --- | --- |
| Pokédex, Pokémon/PC, Trainer ID and Options menu icons | Pokémon Platinum start-menu sprite cells |
| Explore icon | FireRed Town Map item icon |
| Bag icon and illustration | FireRed closed backpack frame (already native) |
| App/loading/fallback/showcase ball, favicon and desktop icon | Existing bundled PokéAPI Poké Ball item PNG; former custom SVG removed |
| Main, navigation and Bag window edges | FireRed standard text-window tiles |
| PC Forest/Coast/Cave/City backgrounds | FireRed Forest/Beach/Cave/City wallpaper tiles and tilemaps |
| Trainer Card background and eight SQL badge pictures | FireRed Trainer Card tiles/background and badge sheet |
| Grass battle terrain | Original FireRed tiles and palette; the authored orange bands and olive recolor are removed |
| Battle dialogue frame | Original FireRed blue/gold palette; prior slate/white recolor removed |
| Sinnoh town map | Platinum touch-screen map layers, palette and native town-map location data |
| Ordinary Sinnoh field buildings | Native FireRed Pallet/Cerulean structure crops, fitted to authored footprints |
| Sinnoh painted paving, boardwalk, water and sand | Original tiles from bundled Gen III map artwork; cave/tree recoloring removed |

The eight badge images still represent **SQL challenge milestones**, as labeled
on the card. Importing their pictures does not implement or award Gym victories.
SQL/editor-only symbols have no direct game counterpart and remain functional
application icons. Layout, navigation labels, theme palettes, accessibility
outlines, controls and motion remain adapted for desktop/tablet SQL practice.

## Pins and rebuilds

- FireRed: `pret/pokefirered` at `ce6406d8c2eaf46d543c8a2606de0c3cb1951982`.
- Platinum: `pret/pokeplatinum` at `0660186c565124910371a3b0516a1b1df31b5b93`.
- Existing Emerald/Crystal inputs retain their pins in `scripts/safari_sources.py`.
- Species/item art continues to use the existing PokéAPI sprite vendor.

```powershell
py scripts/build_game_ui.py           # menu/window/PC/card/badges and Sinnoh atlas
py scripts/build_region_assets.py sinnoh # authored fields with native Gen III crops
py scripts/build_safari_assets.py     # native battle/background/window assets
cd web
node scripts/create-icon.mjs          # ICO from the bundled game Poké Ball PNG
npm.cmd run build
```

`shared/ui/native-assets.json` records source/output SHA256 hashes and PNG sizes.
The Sinnoh overview records its own native inputs, anchor hash and image hash.
The build verifies these along with the existing Safari map manifests. Source
art is cached at build time; runtime uses local PNGs, including offline.

Platinum's NCGR source sheets use grayscale index previews, and NSCR screens
use Nintendo DS screen-block ordering. The converter handles these explicitly,
composites the original background/map layers and derives anchors from native
`town_map_data.json`. The upstream Eterna area is spelled `eternia_city` in that
file; this alias is handled without altering the downloaded source.

## Remaining authored field content

Sinnoh's walking layouts and collision geometry remain authored; they are not
extracted native DS field maps. The ordinary building/terrain pixels are now
native Gen III art adaptations, sampled with nearest-neighbor filtering. The
subsequent walking-layout pass uses their native dimensions in the six towns;
see the walking-layout section of WORLD_MAPS.md. A few
props remain original drawings: Jubilife's fountain, Oreburgh's construction
landmark, and Valley Windworks' turbines. Their native DS counterparts require
an evaluated model/texture conversion and projection path. They are not silently
substituted with unrelated items or described as original DS artwork.

Native overworld, trainer, battle, Pokémon and music sources already bundled
elsewhere remain in use. See [Safari credits](../web/public/safari/CREDITS.txt)
and [world-map provenance](WORLD_MAPS.md). Game artwork belongs to its original
owners; source-project licenses are not artwork licenses.
