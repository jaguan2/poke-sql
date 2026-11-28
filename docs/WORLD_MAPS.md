# World-map migration

The opt-in [Smooth overworld](OVERWORLD_EXPLORATION.md) now builds on this
exporter for continuous movement, Surf, connected-map drawing and visible SQL
encounters. This report describes the original layered-map migration; Classic
keeps that rendering path. Current movement behavior and limitations are in the
overworld report.

## Assessment and first increment

The November 2026 world proposal describes a much larger product. The current
application already has a useful import pipeline and a playable exploration
system; replacing it wholesale would discard working behavior.

React/Vite/TypeScript compose the SQL workspace and game UI. CodeMirror edits
SQL; sql.js runs in a worker. `src/app/use-safari.ts` coordinates expeditions,
while `features/safari/model.ts`, `zones.ts`, `regions.ts` and `persistence.ts`
own movement, encounters, connections and saves. PC captures commit separately
in IndexedDB. These ownership boundaries must survive renderer changes.

`scripts/build_region_assets.py` already imports native FireRed and Emerald
maps, edge offsets and selected warps. `crystal_maps.py` imports Crystal, not
HeartGold. Sinnoh uses authored PokéSQL layouts assembled from bundled art and
native Gen III building crops and a few authored landmarks; these are not extracted DS environments. Unova's former
authored world and map assets have been removed for now. Its Pokémon remain in
the database, National Pokédex, mystery encounters and existing collections.
`SafariMap.tsx` displays a complete PNG in a scrolling DOM world, overlays
sprites/effects, preloads neighboring images and provides keyboard/touch input.
The assets are generated, hashed and included in the production offline cache.

The limitation is visual flattening: metatile halves are composited before
export, losing foreground occlusion and editable tile layers. Building drawing
in `region_architecture.py` also embeds visual construction in Python rather
than a reusable editor asset library. The first increment therefore exports
native layers and metadata without changing movement or game saves.

## Migration decisions

1. Reuse the existing pinned sources and palette/flip decoder. Export existing
   outdoor Kanto and Hoenn towns, routes and forests as finite orthogonal Tiled
   JSON plus PNG atlases. Preserve 16-pixel logical metatiles and raw
   collision/elevation. The current coverage is 10 Kanto and 13 Hoenn maps.
2. Integrate those visual layers through two Canvas surfaces in the existing
   world: ground below actors, foreground above actors. Keep React controls,
   accessible menus, camera interpolation, encounter grading and persistence.
   Load the selected tilemap and its immediate neighbors. Keep the existing image as a loading/error
   fallback and for the overview. No perpetual animation loop is needed for
   static source animation frame zero.
3. Bound decoded-asset caching and validate scrolling and input on
   desktop and iPad. Smooth now uses one animated Canvas with viewport culling.
   Reassess Phaser when scene/effect complexity justifies an engine dependency;
   retain the deterministic controller and existing capture state ownership.
4. Treat topology/gameplay as a separate migration. Validate converted movement
   against existing portals, ledges, saves and encounter tests before replacing
   the current rows. Smooth consumes normalized terrain with elevation and
   separate bridge planes; raw metadata alone is not complete native behavior.
5. Keep this exporter increment outdoors. Broaden outdoor coverage and validate the
   adapter with Emerald as well as FireRed. DS geometry needs its own adapter and render/occlusion study before
   attempting HeartGold or Platinum imports.

Keep runtime files under `web/src/features/safari/world/`, extraction in
`scripts/`, and generated output under `web/public/safari/worlds/`. Do not add a
parallel top-level `src/game` tree that bypasses current feature boundaries.

Keep React for the application UI and existing reducers for player/game state;
Zustand currently adds no needed ownership boundary. Python/Pillow remains the
offline extraction toolchain, with Node validating production output. Tiled is
the interchange/editor choice, while Aseprite can author replacement pixel art
and Blender can later produce consistent orthographic DS sprite renders. Those
desktop tools are optional authoring dependencies, not runtime requirements.

## Community research

Research checked against the linked primary sources on 2026-11-26. These tools
were inspected as references, not installed or executed. No third-party tool
implementation is copied into this increment.

| Resource | What it provides / decision |
| --- | --- |
| [pret project directory](https://pret.github.io/) | Generation-specific repositories, not a universal interchange format. |
| [pokered](https://github.com/pret/pokered), [pokecrystal](https://github.com/pret/pokecrystal) | Assembly/block-based sources. Crystal already has a separate local adapter; defer Red because the requested Kanto reference is FireRed. |
| [pokefirered](https://github.com/pret/pokefirered), [pokeemerald](https://github.com/pret/pokeemerald), [pokeruby](https://github.com/pret/pokeruby) | Gen III layout JSON, binary map words, metatiles and palettes. Reuse current FireRed/Emerald revisions; Ruby must be verified separately before claiming compatibility. |
| [pokeheartgold](https://github.com/pret/pokeheartgold) | README explicitly warns of unstable WIP disassembly and incomplete decompilation; do not promise a ready-made map exporter. |
| [pokediamond](https://github.com/pret/pokediamond), [pokeplatinum](https://github.com/pret/pokeplatinum) | WIP DS decompilations. Inspect matrices, events, models and movement separately from GBA tile formats. |
| [Porymap manual](https://huderlem.github.io/porymap/) | Primary authoring/inspection reference for Gen III collisions, events, connections, prefabs and metatiles. Use externally to inspect the source project. |
| [Porymap attribute decoder](https://github.com/huderlem/porymap/blob/master/src/core/metatile.cpp) | Confirms FRLG layer bits 29–30 versus RSE bits 12–15. Use the pinned game's definitions for conversion, not a moving editor implementation. |
| [PokeCompDumper](https://github.com/SirSnorealot/PokeCompDumper) | GPL-3.0 Windows/Qt6/MSVC tool; lists English Ruby/Sapphire/FireRed/LeafGreen/Emerald. Exports decomp-style maps/events, sprites and stitched PNGs. ROM-specific offsets and the README's experimental music warning limit confidence; no automated reliability claim. Useful for local ROM/hack inspection, unnecessary for our existing pret sources. |
| [DSPRE](https://github.com/DS-Pokemon-Rom-Editor/DSPRE) | Gen IV editor with map models, collisions, permissions, buildings, warps and matrices. Documents NSBMD/BIN and DAE/GLB exports. [License](https://github.com/DS-Pokemon-Rom-Editor/DSPRE/blob/main/LICENSE) is AGPL-3.0. Candidate external DS inspection/export tool. |
| [DS Map Studio](https://github.com/Trifindo/Pokemon-DS-Map-Studio) | Creates Gen IV/V maps using a tile-like interface and exports models. Its README explicitly says it cannot import or modify original game maps. NSBMD conversion requires separately supplied converter binaries. No explicit license was established from its top-level listing; do not incorporate its code. |
| [CTRMap CE](https://github.com/ds-pokemon-hacking/CTRMap-CE) | Gen V editor framework; actual game functionality relies on plugins. GPLv3 plus a README noncommercial request; review core and plugin terms separately. Defer to the Unova research phase. |
| [Tiled JSON format](https://doc.mapeditor.org/en/stable/reference/json-map-format/) | Existing editor interchange with tile/object layers, GIDs, properties and atlas metadata. Prefer this over a custom visual editor. |

For visual reference, [Pokéarth](https://www.serebii.net/pokearth/) and
[Bulbapedia](https://bulbapedia.bulbagarden.net/) can help compare geography;
[Spriters Resource](https://www.spriters-resource.com/),
[Models Resource](https://models.spriters-resource.com/) and
[Textures Resource](https://textures.spriters-resource.com/) are discovery
catalogs, not blanket redistribution licenses. No new assets are taken from
those catalogs in this increment.

## Format and importing

The commands, exact export contract and limitations below accompany the working
prototype; future adapters must preserve these units and provenance boundaries.

From the repository root, with Python 3.10+ and Pillow installed:

```powershell
python scripts/export_world_maps.py all
# Export all existing outdoor locations in one region:
python scripts/export_world_maps.py kanto
python scripts/export_world_maps.py hoenn
# Re-export one existing location, or add another existing Gen III location:
python scripts/export_world_maps.py kanto pallet-town
python scripts/export_world_maps.py hoenn littleroot-town
# Use local source files, without fetching missing inputs:
python scripts/export_world_maps.py kanto --source-root C:/path/to/pokefirered
python scripts/test_world_maps.py -v
cd web
npm.cmd run build
npm.cmd exec -- playwright test tests/browser/world-maps.spec.ts
```

Without `--source-root`, sources come from the same pinned revisions in
`safari_sources.py` as the existing importer, with cached downloads. A local
source tree records a null revision rather than pretending its revision was
verified; every consumed source file still has a SHA-256. The prototype can
export locations that already exist in the region's route and movement catalogs.
Adding a new location still requires extending those catalogs and rebuilding
the existing regional importer first. Re-run all registered exports after
changing a shared converter; the build rejects stale generator hashes. The
`all` command rebuilds both regions. Default selections include only towns,
routes and forests; explicitly requesting a gate, cave or interior is rejected.
The production check also rejects missing outdoor exports.

Each map produces:

- `<id>.tmj`: finite orthogonal Tiled map, three visible tile layers and a hidden
  source-events object layer. Tile and event positions in this file use pixels
  as defined by Tiled. An inline atlas declaration uses one-based GIDs; zero is
  empty. Half-metatile GIDs are `nativeMetatileId * 2 + half + 1`. Palette and
  flip information is baked into independently replaceable 16×16 atlas tiles.
- `<id>-tiles.png`: transparent paired metatile atlas with 16 columns. Only
  metatiles used by this map are populated; holes retain stable native IDs.
  This is a map-scoped reusable palette-resolved atlas, not yet a deduplicated
  cross-region art library.
- `<id>.world.json`: versioned, renderer-independent metadata. Coordinates in
  this file are **logical tile coordinates**, not pixels. `id` is namespaced
  (for example `kanto.pallet-town`); `runtimeId` retains the existing save key.
  `tileSize` and `visualTileSize` are both 16 for this adapter. `width`, `height`,
  `spawnPoints`, `camera`, `weather` and `lighting` describe the environment.
  `cells` contains row-major metatile IDs, raw two-bit collision values, raw
  four-bit elevation and metatile behavior IDs. `movementRows` and `transitions`
  snapshot the current application's supported walking policy; raw collision
  values must not be interpreted as the complete gameplay rules.
  `terrain.version: 1` and its character rows normalize supported land, grass,
  water, bridge and ledge permissions for Smooth exploration.
  Native `connections` retain direction/offset and unresolved destinations;
  `warps`, `objects`, `interactions`, `triggers` and `border` preserve source
  events rather than inventing missing behavior. Numeric warp indices remain
  native identifiers. `runtimeDestination: null` means no implemented location.
  `source` records archive URL, revision, source hashes and original-game asset
  classification. No source scripts are executed by the browser.

`features/safari/world-assets.json` registers lazy runtime tilemap paths and
their dimensions, and hashes all generated files and the relevant converter code. Production checks
bind exported geometry to current movement maps and validate layers, atlas
dimensions, hashes and supported GIDs. Text hashes normalize CRLF/LF for fresh
Windows checkouts. The existing offline build discovers all output files.

The exporter resolves native layer types from the pinned source:
[FireRed map words and layer enums](https://github.com/pret/pokefirered/blob/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/include/global.fieldmap.h)
and [background assignment](https://github.com/pret/pokefirered/blob/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/src/field_camera.c).
Normal maps the two halves to detail/foreground, covered to ground/detail, and
split to ground/foreground. Actors render between detail and foreground and
sort by their tile Y coordinate. This is the ordinary walking plane; it does
not reproduce every native sprite-priority/elevation interaction.

Open a `.tmj` beside its PNG in Tiled to inspect layers and source event
placements. Generated output is currently an inspection baseline: edits are
overwritten by regeneration and deliberately rejected by production hashes.
An authored override/import workflow and collision editor remain future work.
Smooth includes a read-only debug overlay. Do not claim arbitrary Tiled features are supported: the
runtime accepts only the exported finite, square-tile, one-atlas subset without
Tiled GID flips (already baked), layer transforms or custom blend modes.

## Outdoor loading and memory

`world/assets.ts` owns a shared cache of parsed tilemaps and decoded PNG atlases.
The visible map holds a lease; immediate, implemented neighbors preload once
without recursively loading the region. Concurrent requests reuse one promise.
Changing area cancels unfinished, unused neighbors; the destination can acquire
an in-flight preload before cleanup. Failures are evicted so a later visit can
retry. Neighbor failures do not disable the visible map or walking.

Least-recently-used, unpinned entries are evicted above six entries or 12 MiB of
estimated decoded atlas/GID/elevation memory. Pending requests count toward the entry
limit. Visible views take priority if their assets alone exceed a budget; all
current exported atlases fit comfortably within it. This budget does not include
the browser's HTTP/image cache, object overhead or the active Canvas surfaces.
Only the current map owns Canvas backing stores, which are released on unmount.
Classic maps draw once at native resolution and use the existing camera transform.
Smooth draws culled tiles and actors into one viewport Canvas each frame.

For the current exports, the largest atlas/GID/elevation estimate is 2,028,032 bytes
(Verdanturf Town). The largest pair of RGBA Canvas surfaces is 7,630,848 bytes
(Viridian Forest). These are allocation estimates from the exported dimensions,
not measurements of total browser memory or frame-rate guarantees. Generated
Tiled/metadata/atlas files total about 1.58 MB for all 23 maps.

## Limitations and next validation gates

- All existing Kanto and Hoenn outdoor towns, routes and forests use layers.
  Gates, caves, Johto, Sinnoh and Safari habitats retain the existing renderer.
  Interiors remain unimplemented. The newer [gameplay plan](GAMEPLAY_FOUNDATION.md)
  permits them when a concrete feature justifies extending the pipeline.
- The exporter compares each pixel of the recombined layers against the
  existing committed PNG before registering output. This validates against
  the current decoder and baseline, not a captured original-game framebuffer.
  Source game behavior remains the external reference for future visual tests.
- In Classic, Canvas surfaces render once per map at native resolution. Actors and
  camera interpolation remain DOM-based; adjacent flat images retain their existing
  preload path alongside layered-asset preloading. No seamless adjacent-map
  compositor or viewport tile culling in that path. Smooth adds both through its
  separate viewport renderer; neither path introduces a frame-rate guarantee.
- Native animation frame zero is retained. Dynamic lighting, day/night,
  animated source water, full native bridge/stair/elevation rules, NPC behaviors,
  native event scripts and unopened doors are not newly implemented.
- Classic does not use exported elevation to unlock water or story obstacles.
  Smooth uses the conservative subset in the overworld report. Existing catches,
  SQL assignments, PC ownership and save keys keep their current semantics.
- No DS models were extracted. The choice between orthographic sprite exports,
  layered section renders and reconstructed tiles needs a small DSPRE export
  plus camera/lighting/occlusion reference test. Do not infer identical DS
  formats from matching game generations.
- Source artwork remains original Pokémon game material. Tool licenses do not
  grant rights to that artwork. The manifest marks redistribution licensing as
  unestablished; existing credits still apply. No ROM is downloaded or needed
  for these pret-based exports. Use local source inputs where required, and
  establish appropriate rights before public/commercial redistribution.

Introduce authored asset overrides, a richer validator and an editor
workflow; measure performance before choosing the scope of a Phaser migration.

## Verification of this increment

All 23 generated outdoor maps recombine pixel-for-pixel with the committed native
PNGs. The cache-independent Python tests cover raw collision/elevation bits,
FRLG/RSE layer routing, palette transparency, flips, half ordering and
outdoor-only selection. All four Python tests passed.
Production build checks cover architecture boundaries, converter provenance,
exported geometry, assets and offline inclusion.

The focused Playwright run passed 45 checks across the outdoor maps, asset
cache, Kanto, Hoenn, movement, Unova retirement and original pilot specs.
Every outdoor map was drawn and compared with its PNG in the browser. Checks
include desktop and both iPad orientations, boundary crossings, source pixel
comparison, fallback rendering, catches/PC, save reload, touch/keyboard movement
and offline reload. Cache checks cover byte/entry eviction, concurrent loads,
shared preloads, failure retry and cancellation during travel.

Traces, screenshots and native Canvas allocation estimates are retained under
`web/test-results/world-outdoors-verification/`. Viridian Forest and Route 104
desktop renders were also visually inspected. These are production-browser
checks, not a packaged Electron or physical-iPad performance certification.

## Native artwork update (2026-11-28)

Sinnoh's overview now renders original Platinum map layers and derives markers
from native town-map data. Its walking geometry remains authored, but ordinary
buildings and painted surfaces now use bundled native Gen III crops. The native
DS field-map/model pipeline remains separate. See [asset inventory](NATIVE_ASSETS.md)
for the few remaining authored props and all rebuild/provenance details.


## Sinnoh walking-layout pass (2026-11-28)

The six towns now use native-size building footprints and narrow connected
footpaths instead of repeated broad plazas. Twinleaf has two homes, pond-side
space and flower beds; larger towns retain their lab, station, Center and other
landmarks. Town dimensions remain 34 × 28 tiles.

| Area | Previous tiles | Current tiles |
| --- | --- | --- |
| Route 201 | 24 × 18 | 40 × 24 |
| Route 202 | 24 × 18 | 28 × 36 |
| Route 203 | 24 × 18 | 40 × 24 |
| Route 204 | 22 × 20 | 28 × 34 |
| Eterna Forest | 26 × 20 | 34 × 38 |

These authored layouts add bends, separate grass clearings, tree groves and
optional paths. They preserve native artwork and the existing location/encounter
pools. They do not claim to reproduce native DS geography. Classic movement is
still used in Sinnoh; this does not extend the Smooth renderer to another region.

Changed layouts increment their revision. Existing exploration saves use the
existing relocation contract to return to the safe trailhead while keeping
progress and drafts. PC ownership is untouched. All exits, grass clearings and
Honey Tree approaches are checked; the desktop/tablet browser checks walk an
expanded route and reload offline at the same position.
