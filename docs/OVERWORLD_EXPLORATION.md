# Overworld exploration

## Play the initial slice

Open **Explore → Movement → Smooth overworld** in an outdoor Kanto or Hoenn
location. Classic remains the default and is available for every existing area.
The shared controller supports all 23 exported outdoor maps. Caves, gates,
Johto, Sinnoh and Safari habitats still require Classic. Interiors are excluded;
Unova's world stays retired, while its species, sprites and collections remain.

| Control | Action |
| --- | --- |
| WASD / arrows | Continuous movement, including diagonals |
| Shift / Run checkbox | Run |
| E / Space / nearby Pokémon button | Choose an encounter |
| F / Surf / Land button | Mount or dismount at a valid shoreline |
| Automatic Surf checkbox | Traverse a shoreline while moving toward it |
| M | Open or close Region map |
| P | Open My Pokédex |
| Escape / Pause | Pause or resume |
| Direction buttons | Hold to move with pointer/touch controls |

Try Pallet Town's north boundary into Route 1 for connected land travel. Hoenn's
Route 103 has accessible water east of its western bank (logical shoreline
position 21,9 facing right). Surf is available immediately, without requiring an
owned Pokémon or progression unlock. Approach a visible Pokémon and interact,
then use the existing encounter's Catch action to open its SQL task. Correct SQL
guarantees capture, and these encounters allow unlimited incorrect attempts.
Leaving an encounter remains available. Keep exploring returns to the saved
continuous position and traversal mode. Walking alone never starts an encounter
in Smooth mode.

## Existing systems and reuse

| Subsystem | Existing ownership and decision |
| --- | --- |
| Application | React/Vite/TypeScript, plain CSS, feature boundaries. Keep app composition in `app/`; the world implementation stays in `features/safari/world/`. |
| Rendering | Classic `SafariMap` uses a scrolling DOM world with layered static Canvas terrain. Add one viewport Canvas for animated Smooth exploration; reuse atlases and asset cache. |
| Maps | Existing FireRed/Emerald importers, movement catalogs and native connection offsets. Extend generated metadata instead of reading image colors. Crystal has its own importer; authored Sinnoh maps are not extracted DS geometry. |
| SQL | CodeMirror, the sql.js worker, isolated original-data catch checks and existing feedback. No second SQL engine, query replay or string-matching grader. |
| Captures | `use-safari`, `model` and existing encounter UI/animations. The app's capture receipts, stable reward IDs, IndexedDB ownership transaction and retry outbox remain authoritative. |
| Discovery | Existing journal, Seen/Owned status, achievements and Trainer ID. Starting an encounter reveals the existing sighting; a correct task awards the catch. Merely drawing a distant sprite does not currently register Seen. |
| Persistence | Existing localStorage Safari session plus an additive optional `exploration` snapshot. PC ownership remains in its separate IndexedDB database; SQL reset cannot erase it. There are no server accounts or cloud saves. |
| Desktop/offline | Same production frontend in the sandboxed Electron renderer. All maps, sprites, SQLite and WASM remain bundled. Offline manifest still derives from the complete build tree. |

## Research and decisions

Primary references were inspected on 2026-11-27. They inform the design; no new
community engine or implementation code was incorporated.

| Reference | Finding and application |
| --- | --- |
| [Emerald player movement](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/src/field_player_avatar.c) | Surf uses movement state and collision checks; dismount requires ordinary land elevation. Keep traversal inside the same world controller with a validated transition. |
| [Emerald terrain behaviors](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/src/metatile_behavior.c), [constants](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/include/constants/metatile_behaviors.h) | Water and bridge permissions are behavior data. Normalize the supported subset at export time. |
| [FireRed terrain constants](https://github.com/pret/pokefirered/blob/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/include/constants/metatile_behaviors.h) | Similar names do not imply matching numeric behavior IDs. Maintain a source-specific conversion. |
| [Emerald field map](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/src/fieldmap.c) | Native map connections include offsets. Preserve them instead of lining every edge up at zero. |
| [Crystal movement](https://github.com/pret/pokecrystal/blob/master/engine/overworld/player_movement.asm) | A separate source-generation adapter is necessary; do not interpret Crystal collision bytes as Gen III. |
| [Porymap](https://github.com/huderlem/porymap), [collision manual](https://huderlem.github.io/porymap/manual/editing-map-collisions.html) | Useful external authoring/inspection tool for Gen III maps, connections and collision/elevation. Its LGPL-3.0 tool license does not license game artwork. |
| [Emerald Expansion](https://github.com/rh-hideout/pokeemerald-expansion) | Reference for extending an existing game engine. Its native runtime is not an appropriate replacement for PokéSQL's browser worker and capture storage. No code imported. |
| [Pokémon Essentials](https://github.com/Maruno17/pokemon-essentials) | RPG Maker/Ruby architecture, separate graphics/audio distribution. Useful design reference, unsuitable as a drop-in web engine; no code/assets imported. |
| [Tiled worlds](https://doc.mapeditor.org/en/stable/manual/worlds/) | A useful editor representation of positioned maps. Runtime continues to consume the existing finite Tiled subset plus native directed connections. |
| [Phaser](https://github.com/phaserjs/phaser) | Remains an option if scene/effect complexity warrants it. The current Canvas slice supports continuous movement, culling and camera continuity without an engine dependency or parallel capture state store. |

The earlier [world-map report](WORLD_MAPS.md#community-research) covers DSPRE,
CTRMap, DS extraction and source-art provenance. DS extraction is still deferred.
No redistribution rights are inferred from decompilation or editor licenses.
Existing local trainer sheets and PokéAPI Pokémon sprites are reused; no new art
was downloaded for this slice.

## Runtime architecture

`physics.ts` is a pure controller: continuous position/velocity in logical tiles,
facing direction, movement mode, elevation, traveled distance and an optional
locked transition. `SPEEDS` defines walking 3, running 5 and Surf 4 tiles/second.
Diagonals are normalized. Exponential acceleration uses an integrated displacement
with 1/120-second bounded collision substeps and a 100ms frame ceiling. Long
background stalls therefore cannot teleport a player through obstacles.

Feet use a square radius of 0.21 tiles. Each corner must have a permitted surface
at a compatible elevation. Movement resolves each axis separately for wall
sliding. Native cardinal ledges initiate a short validated jump to their landing
cell; reverse traversal remains blocked. Shoreline transitions take 0.22 seconds,
lock repeated activation, require land elevation 3 or shared elevation 0, and
cannot switch planes on bridge tiles.

`SmoothOverworld.tsx` owns one requestAnimationFrame lifecycle and transient input,
player, camera and entity refs. React renders menus and throttled HUD updates;
it does not render each movement step. `render.ts` culls tiles to a 384×256
logical-pixel viewport, rounds final drawing coordinates and disables smoothing.
Details render below Y-sorted actors and foreground above them. Surfing under a
normalized bridge redraws its deck above the player. Camera following uses
exponential interpolation, retaining world origin across offset map connections.

Only the current map and immediate implemented neighbors hold asset leases.
Crossing a loaded boundary preserves fractional coordinates, facing and movement
mode. Departing neighbors release their leases; the shared cache evicts unused
assets. Unmount releases listeners, animation frames, images and Canvas storage.
Missing or malformed terrain blocks Smooth loading and offers Classic recovery.

Movement keys require viewport focus. Text inputs, composition, modifier
shortcuts, modal dialogs, open travel menus, pause, visibility loss and blur stop
movement. Entering an encounter unmounts the world, so SQL typing cannot keep
walking. Held pointer controls release on pointer-up, cancellation or capture loss.

## Terrain contract

`.world.json` retains raw `cells` and Classic `movementRows`, and adds
`terrain: { version: 1, rows: string[] }`. Dimensions match the Tiled map.
Each character describes one logical tile, independently of its appearance:

| Symbol | Walking/running | Surf | Meaning |
| --- | --- | --- | --- |
| `.` / `g` / `s` | Yes | No | Ordinary land / encounter grass / reserved sand |
| `~` | No | Yes | Supported water behavior with clear native collision |
| `B` | Native deck elevation | Water plane 1 | Supported Emerald bridge |
| `>` / `<` / `^` / `v` | Validated directional jump only | No | Native one-way ledge |
| `#` / reserved `i` | No | No | Solid or unsupported behavior |

Land retains native elevation; zero is a shared plane. Water uses plane 1.
Unsupported special terrain remains solid. This is a conservative subset, not
a reproduction of every native movement rule. `parseTerrain` checks dimensions,
symbols, elevations and cardinal connection offsets; the build also checks
hashes, geometry and converter provenance. Rebuild generated files with
`python scripts/export_world_maps.py all`; do not hand-edit generated metadata.

Future terrain versions can add speed multipliers, polygons, currents, stairs
and authored overrides after representative maps and tests exist.

## Visible Pokémon and encounter handoff

`wild.ts` searches reachable nearby habitat with compatible elevation, then
creates at most three entities. Grass uses the existing map table, weather and
date conditions. Surf currently reuses PokéSQL's wetlands pool; these are
educational encounter distributions, not official route-specific Surf tables.
Repel suppresses new groups. Entities idle or wander at 0.45 tiles/second within
1.5 tiles of home, respecting terrain and their feet collision tests.

Groups are deterministic from map, date, traversal plane, local six-tile chunk
and catch count. This bounds work and provides stable encounter/reward IDs.
Groups regenerate on chunk/mode/map changes and after a catch; their exact
wandering positions are transient. Uncaught encounters can be revisited.

Interaction requires matching traversal plane and elevation, a distance of at
most 1.6 tiles, and an unobstructed collision-sampled line. Nearby buttons allow
choosing among candidates; E selects the first eligible candidate. The controller
locks before dispatch, the reducer validates state/species/ID, and the existing
encounter state machine opens. It always sets `fleeAfter: null` for visible
encounters, preserving the existing grading, animations, capture receipt, PC,
Pokédex and achievement path. No combat or random success roll is added.

Continuous snapshots save on stopping, mode/map changes, blur, encounter handoff,
unmount and periodic movement checkpoints. A safe discrete land anchor remains
for Classic compatibility. Navigation and mode toggles increment a generation
number so late callbacks cannot reverse them. Invalid additive snapshots are
discarded without erasing the expedition, Bag, counters or catches. Runtime
collision validation recovers an invalid continuous position to the legacy anchor.

## Validation and next increments

Automated coverage lives in `tests/engine/overworld.spec.ts`,
`tests/engine/overworld-water.spec.ts`,
`tests/browser/overworld.spec.ts`, `tests/desktop/overworld.spec.ts` and
`scripts/test_world_maps.py`. Engine checks cover frame-rate parity, diagonals,
sliding, elevation, ledges, manual/automatic Surf, bridge planes, water connection
offsets, spawning, wall-blocked interactions, stale saves and canonical SQL retries.
Browser checks exercise desktop and both iPad orientations, controls, connected
land/camera travel, real Route 103 Surf, offline restoration, SQL capture and PC
deduplication. Desktop smoke checks use disposable profiles and the production
frontend through `pokesql://app`; they are not an installer certification.

Add `?debug=overworld` to the production URL (or use the development server) for
the debug panel. It exposes map, continuous position, mode, elevation, frame-time
FPS estimate, cache count, wild entity states and a toggle for solid tiles and
the feet hitbox. It does not yet visualize every connection or spawn polygon.

Current limits and ordered follow-up:

1. Validate connected *native* water routes. None of the current 23 outdoor maps
   has a compatible water-to-water edge; the generic water crossing is tested
   with synthetic connected maps, while real shoreline/Surf is tested on Route
   103. Import an adjacent outdoor water pair before claiming ocean-route coverage.
2. Extract and review dedicated running/Surf sheets. Current running reuses the
   four-direction walking sheet at a faster cadence; Surf uses that trainer,
   the existing Lapras sprite and wake rings with an interpolated mount. It does
   not have native directional mount art or all requested animation states.
3. Exercise real bridge geometry, stairs, object collisions and NPC interactions.
   Bridge plane logic is unit-tested; decorative NPCs have no new behavior or
   collision. Native scripts, doors, waterfalls, currents and story obstacles
   are not executed. Use Classic for unsupported exits and environments.
4. Profile real iPads and longer sessions before adding more regions or choosing
   Phaser. FPS debug output is a frame estimate, not a performance guarantee.
5. Add authored spawns, persisted entity cooldowns, cycling, accessible key
   remapping, reduced camera motion, zoom/fullscreen, fishing and terrain-aware
   click-to-move in separate increments. Click-to-move must use pathfinding;
   direct movement through obstacles is not a fallback. Interiors remain excluded.

## Recorded verification — 2026-11-27

| Check | Result / retained evidence |
| --- | --- |
| `npm.cmd run build` | Passed TypeScript, architecture, assets/provenance, Vite and generated offline cache (1,551 files). The existing large-chunk advisory remains. |
| Engine/browser selection | 137 passed: all engine specs collected at run start, Smooth desktop/tablet controls and catches, Classic movement, mystery SQL, Unova retirement, layered-map fallback/offline behavior and all 23 outdoor pixel comparisons. Traces/screenshots: `web/test-results/overworld-final/`. |
| Additional aquatic contract | 1 passed: real Route 103 water spawns/wandering, existing SQL grading, aquatic encounter and caught-session restoration. Trace: `web/test-results/overworld-water-contract/`. |
| Windows Surf restart | 1 passed against the final production frontend in hidden Electron with a disposable profile; position/mode survive restart and renderer has no Node access. Evidence: `web/test-results/overworld-desktop-final/`. |
| Existing Windows catches | 2 passed for field-notes and tracking, including restart and single PC reward. Evidence: `web/test-results/overworld-desktop/`. |
| `python scripts/test_world_maps.py -v` | All 5 passed, including source-specific terrain normalization. |
| Structural review | Reviewed the actual diff for lifecycle/lease cleanup, collision/elevation, save validation, stale callbacks, input focus and existing capture ownership. Fixed stale mode/navigation saves, seam restore, shoreline elevation and mismatched encounter-guide copy; rechecked the changed paths. Shared toolkit skills were unavailable, so review followed the local project adapters rather than claiming the unavailable upstream rubric. |

The final Surf and visible-Pokémon screenshots were visually inspected. Earlier
in this increment, 14 additional browser regressions passed for SQL editor/DB
persistence, isolated challenges, cancellation, transactions, offline SQL, Hoenn
travel/tablet layouts and Classic Kanto catches. That broader run was interrupted
to build the final renderer fixes; it is not reported as a completed full suite.
No packaged installer build or physical-device performance certification is claimed.
