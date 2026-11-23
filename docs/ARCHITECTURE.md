# Architecture and code ownership

PokéSQL is a local React application with a SQLite Web Worker and an optional
sandboxed Electron shell. The frontend uses a feature-oriented structure:
behavior, content, styles, and components for a feature live together. There is
no backend and no runtime API dependency.

```text
scripts/                    Python data build and sprite vendoring
web/
  src/
    main.tsx                React entry point
    app/
      App.tsx               Screen composition and app layout styles
      use-workspace.ts      Workspace state, commands, persistence, async results
      workspace-types.ts    Selection, submitted query contexts, saved queries
      navigation.ts         Typed sectioned navigation destinations
      components/           Sidebar, workspace library and schema-aware SQL editor
      database/
        client.ts           Worker lifecycle, timeout, cancellation, snapshots
        worker.ts           Feature-aware SQL command dispatcher
        protocol.ts         Typed worker request/reply contract
    features/
      practice/             Question catalogs, samples, challenges, worked answers, SQL guide
      mystery/              Random/daily rounds, grading, clues, UTC rollover
      pokedex/              Encounters, journal, achievement goals and UI
      music/                Player, styles, curated track manifest
      profiles/             Trainer ID card, model selection, settings and palettes
      pc/                   Individual capture storage, boxes and featured Pokémon
      safari/               Maps, encounter pools, movement and SQL catch tasks
    shared/
      sql/                  Statement execution, schema reading, result types,
                            editor completions
      storage/              localStorage helpers and IndexedDB snapshots
      pokemon/              Shared Pokémon profile validation and type badges
      ui/                   SQL results and table rendering
      offline.ts            Service worker registration and status
  desktop/                  Electron shell and byte-range parser
  public/                   Committed database, sprites, music and credits
  scripts/                  Build checks, offline cache generation, icon tooling
  tests/
    engine/                 SQL/data integrity and pure domain checks
    browser/                Production web behavior, layouts and offline checks
    desktop/                Isolated Electron smoke checks
    fixtures/               Canonical discovery fixture builders
```

## Dependency rules

PC ownership is stored in `pokesql-collection-v1`, separately from the SQL
workspace snapshot. `features/pc/` owns validated capture receipts, box commands,
IndexedDB transactions and the per-reward localStorage outbox. App composition
maps confirmed Safari/mystery wins to stable reward IDs in `capture-rewards.ts`
and `use-workspace.ts`; it also restores interrupted game saves from committed
captures without SQL replay. The journal remains unique by species. Legacy raw
progress is preserved in the migration transaction, with unknown capture fields
left unknown. Profile highlights reference at most six owned instance IDs.
The profile receives its PC showcase as a React node composed by the app.

Box captures use a unique placement index. Moving to an occupied slot swaps
both records in one transaction. The hook serializes local commands and refreshes
other tabs through BroadcastChannel; each transaction reads canonical IndexedDB
state. Pending rewards survive reload through separate outbox keys, and saves
report failures rather than substituting an empty collection for unreadable data.
Ball-theme IDs/names are shared in `shared/pokemon/ball-themes.json` by profiles,
PC validation and the asset scripts.

- **App composes features.** Workspace navigation and commands belong in
  `app/`; feature modules do not import the application controller.
- **Features own their behavior.** Keep feature components, their CSS, data,
  domain types, and hooks in the same feature directory. Pure domain code
  should not depend on React components or the worker transport protocol.
- **Shared code has no feature dependencies.** A helper belongs in `shared/`
  when multiple consumers need it and it has no application-specific ownership.
  For example, both the mystery notebook and collection use `PokemonProfile`;
  the collection and SQL results use the same type badge.
  Safari and the mystery share `shared/ui/EncounterScene` and generated sprite
  bounds in `shared/pokemon/`. Each feature owns its reveal/encounter behavior;
  the shared renderer receives identity, sprite visibility and dialogue.
  `shared/ui/encounter-capture.ts` owns the trainer-based ball trajectory and
  common catch duration; `EncounterScene` owns ball/flash rendering and CSS.
  Safari's controller keeps its existing visual phases. Mystery uses a local,
  round-keyed presentation timer when unsolved becomes solved. A solved round
  mounted from storage starts settled; navigation cancels the timer. Capture
  commits and solved-round persistence remain independent of visual timing,
  so replay/reload cannot award another Pokémon. Both honor reduced motion.
  `shared/pokemon/pokedex-entries.json` is generated from PokéAPI CSVs by
  `scripts/build_pokedex_entries.py`; its categories and coverage are checked
  against the bundled database. Safari's catch screen combines this local
  catalogue with the verified catch profile to display the registered entry.
  Safari event windows and visitor definitions live in `features/safari/events.ts`.
  The encounter table supplies eligibility and odds to both the field guide and
  movement rolls. The full habitat registry also retains event species for
  saved encounter validation and SQL grading after their window closes.
- **Exploration uses one location registry.** `features/safari/regions.ts`
  adds 15 native FireRed, 14 native Emerald and 17 native Crystal maps to `EXPLORATION_LOCATIONS`; original Safari
  habitats remain in `SAFARI_ZONES`. Movement, saved encounters, SQL grading
  and PC capture locations resolve through the complete registry. A native
  next-tile portal changes the location, arrival coordinate and visited set in
  one pure state update. No encounter or reward is rolled during that crossing.
  `use-safari-movement.ts` owns a single held-input clock for keyboard and touch,
  independent of OS key repeats. Its cadence also sets the camera/player CSS
  transition duration. Release, cancellation, blur, menus, typing and encounters
  stop held input; ordinary area crossings preserve it. Neighboring terrain
  images decode ahead of travel, and each new area's world starts at its own
  camera position rather than animating from the previous area's coordinates.
  `canTravelTo` permits direct drops at any included area; active encounters
  block all travel. Area options include gates and cave floors absent from
  the native town-map overview. Region switching bookmarks the exact location, position
  and direction independently for each region. Additive `visited` and
  `regionPositions` fields leave older version-3 Safari saves intact. Bookmark
  validation checks region membership and walkable coordinates. Town/gate maps
  have empty encounter pools; a one-species pool stays available after a catch.
  `scripts/build_region_assets.py <region>` vendors art and collision/portal
  data together from pinned FireRed/Emerald/Crystal sources. `crystal_maps.py`
  owns the GBC block/palette adapter. All regions share the global flood and
  integrity manifest. Crystal ledges use walkable floor tokens 0–7 and jump
  from the current tile; GBA tokens ><^v jump across the next tile. U marks a
  walkable cell with a north wall. Cut trees are cleared in the Crystal export
  without changing permanent tree or water collisions. The global flood includes linked cave rooms;
  runtime shaking patches stay within the trainer's reachable chamber.
- **Music follows native area IDs through app composition.** Generated regional
  map data retains each game's music ID. `App` passes the current exploration
  ID into the music player; the features do not import each other's runtime
  code. The music catalogue resolves seven Kanto, nine Hoenn and ten Johto local themes. Manual track choice
  stays separate from the derived area theme, and older saved preferences keep
  volume/mute/repeat while enabling area following by default. Source changes
  snapshot actual playback before replacing the media URL; shared themes do not
  reload. The audio element uses CORS mode for service-worker range playback,
  including same-origin URLs. No application state restores autoplay on reload.
- **Cross-feature contracts are explicit and type-only.** The Pokédex accepts
  the mystery round contract to register solved targets. Runtime coordination
  lives in `use-workspace.ts` and `app/database/worker.ts`.
  `app/use-safari.ts` owns the expedition reducer, animation phase, storage,
  and asynchronous catch replies. The Safari UI receives the app's SQL editor
  as a slot and never imports app components. Generic result comparison lives
  in `shared/sql/compare-results.ts` for both Safari and challenge grading.
- **Avoid runtime import cycles.** Use direct imports from the owning module;
  do not add barrel files or compatibility re-exports for internal moves.

`npm run check:architecture` enforces the layer rules and checks runtime import
cycles using the existing TypeScript parser. The production build runs this
check. TypeScript and Vite validate module and asset resolution.

## Execution and persistence boundaries

The worker is an application composition point: it imports feature grading
algorithms and shared SQL execution. The client owns its lifecycle and captures
the last completed snapshot. Stop/timeout recovery never replays SQL. Challenge
and mystery queries use isolated, read-only original databases; free practice
uses the saved mutable database.

`App.tsx` renders state and calls workspace commands. `SqlEditor` owns CodeMirror
configuration, keyboard bindings, schema completion and CodeMirror's text undo
history. Undo/Redo and the caller's Run/Stop controls share a footer below the
editor. Each draft retains its own editor identity so delayed editor updates
cannot overwrite another draft or undo into another round. Editing history
never reverses SQL or PC ownership; busy editors are read-only. Previously saved
queries remain readable, while drafts and run history save automatically.
Submitted query contexts retain their challenge ID or mystery date/target until
completion, including across midnight.

Internal file moves do not rename persisted keys, change IndexedDB stores,
reschedule daily puzzles, or rebuild the Pokémon dataset. Global shell/layout
styles remain in `app/App.css`; feature styles stay next to their components.

## Adding a feature

1. Put its domain model, components, styles and content in `features/<name>/`.
2. Add shared contracts only when another feature needs them. Put worker
   messages in `app/database/protocol.ts` and dispatch in `worker.ts`.
3. Add navigation and workspace commands in `use-workspace.ts`, with rendering
   in `App.tsx`. Keep SQL loading separate from permission to execute it.
4. Add pure checks to `tests/engine/`, browser flows to `tests/browser/`, and
   desktop protocol checks to `tests/desktop/` where applicable.
5. Run the production build and relevant verification. Keep test profiles and
   screenshots under `web/test-results/`; gallery images belong in
   `docs/screenshots/`.

The daily schedule is intentionally frozen/versioned. Future catalog expansion
needs an explicit collection migration and a dataset revision separate from the
schema version. Those behavior changes are distinct from organizing source files.

Safari sessions use `pokesql:safari` with a versioned, validated state. Animation
phase is transient; an active encounter reloads into its assignment without
replaying SQL. Only a worker-confirmed correct result creates `lastCatch` with a
canonical Pokémon profile. The Pokédex consumes that typed catch contract,
merging the `safari` source into the same per-species records as mysteries.
Session version 3 records active/caught/fled outcomes and a per-encounter
five/eight-answer limit or unlimited attempts. Settings changes apply only to
future encounters. Errors and cancelled/timed-out queries do not spend chances;
only a completed incorrect grade can cause fleeing. `recordSafariReply` owns
these transitions, rejects terminal/stale replies and preserves prior catches.
Old saves migrate with unlimited attempts, retaining drafts and progress.
Malformed collection rows are recovered individually; exact original save bytes
are preserved in `pokesql:encounters-recovery` before a recovered collection is
written. A failed backup prevents overwriting the original collection.

## Windows distribution

GitHub Actions builds version-tagged releases with a small NSIS web installer,
its separately hosted application payload and a complete offline portable build.
The generated stable feed and assets are attached to a reviewable draft release.
Application builds are ignored by Git. See [releasing](RELEASING.md).

`desktop/updates.cjs` coordinates main-process checks and download announcements;
`electron-updater` handles verification, caching and installation on normal quit.
It uses its own network session, so the renderer retains its local-only network
guard and no privileged preload API is introduced. Background failures are
handled without blocking window startup. App/profile identities are unchanged;
the updater cache and installation directory do not own the user's database.
Only the updater is a production Node dependency; React, CodeMirror and sql.js
are build dependencies whose browser code is already in the Vite bundle.

## National Dex, native town maps and box dragging

The immutable catalog loaded from the original worker database now includes
all default species profiles. `shared/sql/pokemon-profiles.ts` owns the profile
row mapping shared by mystery lookups and this catalog. Practice SQL cannot
rewrite the National Dex. `use-seen-pokemon.ts` saves additive sightings in
`pokesql:seen-pokemon-v1`; a visible Safari encounter marks a sighting, while
only committed PC receipts establish Owned status. Existing journal records
seed Seen status; unsolved mystery and concealed tracking targets do not. The Safari model
exports visibleSafariPokemonId for rendering and sighting eligibility. The caught-species journal
and achievements keep their original win-only semantics.

`build_region_overviews.py` reconstructs three native town maps from pinned pret
tilemaps and palettes. The generated PNGs and `region-overviews.json` bind image
hashes, source hashes, recipe hashes, dimensions and native anchors. GBC OAM's
hardware coordinate offset is excluded from background anchors. Closely spaced
landmarks share one overview marker; the Area selector retains every location.
The build verifies these assets and the generated offline cache includes them.
No map-selection state, portals or encounter pools depend on the new art.

`use-box-drag.ts` owns pointer gestures, a visual ghost, cancellation and hover
navigation. A completed drop calls the existing atomic move command, including
occupied-slot swaps. Pointer movement never writes collection storage. Touch,
mouse and pen use the same gesture path; the existing keyboard Move controls
remain available. Cached box placements avoid scanning the full collection on
every pointer move.

The Poké Ball button and editor shortcut use the same Safari submit command.
Explicit Preview SQL is separate, so a correct tracking query submitted with
Ctrl+Enter no longer stops at a results-only preview. Catch/Run commands use a
shared game-style panel below the SQL editor; grading, cancellation, outbox
retries and capture animations keep their existing ownership boundaries.

The shared encounter renderer accepts an optional interactive dialogue slot.
Safari uses its existing entrance/battle phases to change the appearance text
into Catch/Run in that window. The selected query encounter ID is transient UI
state; opening, closing or restoring the panel never executes SQL or changes
attempts. CodeMirror owns focus and caret placement when the query editor mounts.
Mystery encounters keep the original status-caption path.

`route-trainers.json` and `public/safari/npcs/` are generated by
`scripts/build_route_trainers.py` from pinned native object events and FireRed
sprites. RouteTrainers paints that scenery inside the scrolling world;
collisions, portals and encounter tables remain in the game model. The asset
check verifies all regional map coverage, positions, facing frames and PNG hashes.

### Expedition Bag

`features/safari/bag-model.ts` owns unlimited Repel availability, the
step-based Repel effect and the optional Shiny Charm. `bag-items.json` feeds the
Bag UI, sprite vendor and production asset checker. Inventory is an additive
`bag` field in the Safari session, committed by the same reducer/save as walking.
A successful move decrements Repel once; its last step is protected. Blocked
moves, open menus, battle queries and direct travel do not consume it. Walking
portals count as steps. The encounter engine applies suppression before rolling
an encounter and derives shiny odds from the same Bag policy shown by the guide.

Repel quantities are derived as unlimited UI values, never serialized as
Infinity. New Bag state needs only remaining steps and Charm activation. Legacy
use counters are ignored and preserved as extra save fields; depletion does not
block use or require a reset. The obsolete starter/reward catalog policy is
removed. Missing Bag data starts with no active effect. Invalid additive Bag
data is removed without discarding a valid expedition/SQL draft. The Bag uses
the existing Safari save-error notice; PC ownership and SQL snapshots remain
independent. No new worker, network request or privileged desktop API is needed.

`scripts/build_bag.py` extracts FireRed's closed 64x64 backpack frame from the
pinned `graphics/interface/bag_male.png` sheet. The full Safari asset builder
uses the same function. The asset manifest verifies its hash; production checks
require the frame dimensions. Navigation and the Bag window share the local PNG.
