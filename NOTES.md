# Design notes

## Safari Zone (2026-11-18)

Nine areas stay open. Verdant Forest (10 forest species), Willow Wetlands
(nine Water species) and Amber Ridge (eight Ground/Rock/Steel species) are joined
by meadow, coast, desert, cave, tundra and volcanic habitats (eight species each). The
featured area cycles by absolute UTC day; it highlights an area without locking
other areas, changing a current encounter, or adding a catch quota. Pool weights
start at 6/3/1 for Common/Uncommon/Rare and double for weather-favored species.
The immediately previous caught species is
excluded from the next roll when present in that area.

Maps now use native Emerald route sections from 20×20 to 60×20 cells, with taller
routes up to 46 cells. A clamped 15×10 camera follows the trainer; the expandable
Route map marks the trainer, trailhead and rustling patch. Crops, entrances and
encounter behaviors live in `features/safari/routes.json`. The asset script reads
the pinned source layouts, block collision bits and metatile behaviors, then
generates both `maps.json` and matching PNGs. Walking uses the section reachable
from the recipe's explicit trailhead; Surf water, ledge jumps and building warps stay blocked. Game graphics
are preserved, including native shorelines, signs, flowers and first animation
frames for water. Movement counts successful tile changes, never blocked input. Ordinary
grass begins rolling at the second consecutive grass step (24%); six consecutive
grass steps guarantee an encounter. A visible rustling patch guarantees one
immediately. Random values and encounter IDs are supplied to pure movement logic,
so React's repeated reducer evaluation cannot reroll a step. Keyboard input is
active throughout Safari exploration, including after clicking outside the map.
Its listener exists only with the roaming map, skips consumed/modifier/composition
events, and leaves typing, media controls, modal settings and the open habitat
picker alone. A new habitat restores map focus. Touch buttons support holding and stop on release,
blur, visibility change and leaving the map.

`app/use-safari.ts` coordinates transient entrance animations and persistent
`pokesql:safari` sessions. The session retains location, facing, successful step
count, catch count, current target/task/draft, and latest confirmed catch.
The field guide renders a semantic encounter table. Its next-roll percentages
and the picker both use `encounterTable`, so weather multipliers and the
immediately previous caught species's exclusion have one owner. A resting row
remains visible for collection progress but cannot be rolled until another
species is caught.
Version 1 clearing saves migrate to version 2 by relocating only the trainer
and resetting consecutive grass steps. Catches, checked attempts, active targets,
drafts, latest catch and total walking steps are retained and validated.
Reload opens an active assignment directly and never submits its saved draft.
Reduced motion skips the entrance delay and disables visual animations.

The encounter and caught views share a responsive 3:2 screen, based on the
Game Boy Advance's 240×160 resolution ([Nintendo technical data](https://www.nintendo.com/en-gb/Support/Legacy-system/Technical-data-619479.html)).
It reaches 720×480 (3×) on desktop, with the SQL notebook and catch summary in
the same centred column. A fixed 250px/220px height previously made desktop
battles stretch into a banner. Sprite positions, platform dimensions and entrance
travel now scale inside the screen; mobile no longer overrides the battle's
shape. `SafariBattleScene` owns the pixel renderer separately from the SQL
notebook. FireRed/LeafGreen tilemaps supply the platforms and lower 48px dialogue
frame; the supplied reference informs a warm striped grass backdrop, olive
platform palette and slate/white text window. Sand, water and cave encounters use
their native scenery; tundra applies a cool palette filter. The native opponent
nameplate is widened for Dex identity/status, with its original level removed.
There are no invented levels or HP mechanics. A local WOFF2 font traces the dark
pixels in the game's normal Latin glyph sheet and retains its advance widths;
CSS adds its pixel shadow. All lettering scales with the 240px game coordinate system.
Generated alpha bounds align unchanged PokéAPI sprites to the far platform,
preserving native small-species sizes and fitting large sprites inside 64×64 pixels.
The dialogue occupies the lower 30%; the SQL notebook supplies the catch action.

Four assignments cycle by successful catch count: field notes, stat scan, type
tracker, and ability survey. Their SQL runs through a new worker action against
a fresh original database with query_only enabled, preserving practice edits.
Generic result comparison was moved to shared SQL utilities. It checks ordered
results, columns, types, NULLs and duplicates while allowing aliases. Syntax
errors/cancellation do not consume checked-query attempts; wrong valid results
do. The field task has no failure chance after a correct result. Catches merge
into the journal's unique species and existing achievement tracks with a new
`safari` source. Saved latest catches import idempotently using their actual
catch timestamp. Existing daily/random save keys and the daily schedule remain.

The previously identified collection recovery bug is fixed as part of extending
the save format: malformed entries no longer discard valid discoveries. The
exact old bytes are backed up before a recovered collection is written; a failed
backup leaves those original bytes untouched and exposes session-only status.

Red's walking and battle-back sheets are vendored unchanged from the pinned
[FireRed/LeafGreen archive](https://github.com/pret/pokefirered/tree/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/graphics).
The 144×32 walking atlas has nine 16×32 frames and native transparency, so the
previous Brendan background mask is removed. Grass effects render in front of
the trainer's feet. The initial drawn terrain has been replaced by native
Emerald metatiles and palettes. Nine route sections now share one collision/art
build, with recipe and generated-geometry hashes checked before production builds.
Daily weather affects encounter weights;
the field guide identifies favored species. Default Pokémon sprites are reused.
All new assets enter the generated offline
cache and Electron package through the existing dist-tree process; build-time
hash checks and [credits](web/public/safari/CREDITS.txt) document the assets.

## Feature-oriented source layout (2026-11-18)

Frontend ownership now follows `app/`, `features/` and `shared/`. Practice,
mystery, Pokédex, music and settings keep their models, content, styles and UI
together. The worker protocol/dispatcher remain application composition, while
SQL execution/result types, storage and shared Pokémon profiles are independent
utilities. Mystery grading no longer imports the transport protocol, and type
badges no longer require importing a SQL results component.

`app/use-workspace.ts` owns transitions, persisted drafts, captured query
contexts, and asynchronous replies. `app/App.tsx` renders that state;
`app/components/SqlEditor.tsx` owns CodeMirror, completion and keyboard bindings.
Persisted keys, editor identities, cancellation/checkpoint rules, dataset bytes,
and the published daily schedule are preserved by this refactor. Tests now live
under `tests/engine/`, `tests/browser/`, `tests/desktop/` and `tests/fixtures/`.

`npm run check:architecture` uses the existing TypeScript parser to enforce
layer boundaries and reject runtime import cycles. See
[the architecture guide](docs/ARCHITECTURE.md) for the layout and extension rules.
The structure-only refactor left the earlier review findings as follow-up work.
The subsequent Safari implementation above addresses collection recovery;
catalog/dataset migration and packaged artifact updates remain separate work.

## Species metadata and forms (2026-11-18)

The rebuilt artifact keeps 1,025 rows in `pokemon` and `pokedex`, and adds
1,579 form records in `pokemon_forms`. Species rows summarize Mega availability,
Mega form count, regional availability, evolution stage and whether a child
species exists. The view appends those fields plus existing capture rate, color,
habitat, baby status, genus, happiness, experience and evolution parent ID;
its original column order is preserved. The catalog has 25 samples and 15
challenges, including Mega Charizard stats/types and baby evolution stages.

Forms link to a species and retain both their source form ID and source Pokémon
variety ID. Names use English form names; stats, dimensions and abilities come
from the variety. `pokemon_form_types` applies source form-specific overrides
for Arceus and Silvally before falling back to variety types. The unknown Arceus
form has no canonical type link; unsupported types never become Normal. Form
abilities are normalized through `pokemon_form_abilities`. Only default species
sprites are bundled; form rows do not introduce runtime sprite downloads.

`pokemon.generation_id` is the species debut, while form introduction comes from
the form's version group and its generation. Charizard is Gen 1; Mega Charizard
X/Y debuted in Gen 6. Mega status uses the source flag, not name matching;
Gigantamax is not Mega. Named Alola/Galar/Hisui/Paldea variants are explicitly
classified, including Galarian Darmanitan's modes and Paldean Tauros breeds.
Pikachu's Alola-cap costume is deliberately excluded from regional status.

Evolution stages start at the root species (1), include babies (Pichu 1,
Pikachu 2, Raichu 3), and reject broken/cyclic parent links. `can_evolve` follows
the species tree, including regional-only branches such as Farfetch'd and
Linoone; it is not a promise about every form or game's evolution conditions.
Mega transformations do not affect this tree. Capture rate is a catch-rate
parameter, not a complete probability, and missing habitats remain NULL.

Schema revision 1 is stored in `PRAGMA user_version`. Loading an older saved
workspace preserves its edits and offers an explicit reset/update notice in
practice mode. Reset replaces practice data with the new original but keeps
SQL, challenge progress and discoveries. New challenges/mysteries and achievement
goals always read the original dataset. The builder writes a partial artifact,
checks integrity and foreign keys, then replaces the committed database only
after success. `python -m unittest scripts.test_build_db -v` covers bad evolution
links and preserving the previous artifact on a failed build.

Sources: [PokéAPI forms documentation](https://pokeapi.co/docs/v2/#pokemon-forms),
[form records](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_forms.csv),
[form types](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_form_types.csv),
and [version groups](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/version_groups.csv).

## Collection achievements (2026-11-18)

My Pokédex has Collection and Achievements views. Achievements project the saved
encounters into national, generation, and type tracks, deduplicating by species
ID and counting both distinct type slots. There is no second achievement save
to migrate or synchronize. Imported discoveries and offline reloads retain the
same earned milestones; search and generation filters do not affect totals.

During worker initialization, `readAchievementCatalog` reads generation and
distinct per-type totals from the original bundled database, before closing that
connection. The initializer returns this metadata alongside the original schema.
Practice SQL and saved database mutations therefore cannot change achievement
goals. Generation membership comes from PokeAPI's species `generation_id`, rather
than evolution families or regional Pokédex availability. Gen 1 has 151 species;
the current default-form dataset has 81 Fire-type species across either slot.
Source: [PokéAPI species CSV](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv).

National milestones are 1, 10, 25, 50, 100, 250, 500, and completion. Generation
tracks use 10, 25, 50, 100, and completion; type tracks use 5, 10, 25, 50, 100,
and completion. Duplicate or unattainable goals are removed. The UI shows the
full collection denominator, earned milestones, and the next reachable target.

## Personal Pokédex (2026-11-18)

Solved daily and random mysteries register their original, canonical target in
`pokesql:encounters`. Intermediate guesses and research results do not register
Pokémon. Entries are unique by National Dex ID, retain their first registration
timestamp, merge discovery modes, and keep the lowest known guess count.
Reprocessing a saved win is idempotent. The collection is separate from the SQL
database, so edits, resets, and replacement mystery rounds cannot erase it.

The latest saved solved rounds are imported at startup. Their original completion
timestamps were not stored; the journal records when they were registered. Older
overwritten rounds cannot be reconstructed. The collection is local to the
browser or desktop profile, like the rest of the workspace.

The collection view preserves the underlying workspace and never submits its
draft. Cards use stored canonical traits and bundled sprites. Filters and 24-card
pages bound the rendered list, while mobile keeps document scrolling. Each SQL
draft has its own CodeMirror instance to prevent delayed value updates crossing
between daily, random, sample, and challenge editors.

## Familiar Pokémon practice problems (2026-11-17)

The catalog now contains 19 Get started prompts and 12 graded challenges.
Eight new examples use Charizard, Pikachu, Eevee, the final Kanto starters,
Snorlax, Gengar, and Dragonite to introduce lookups, comparisons, joins, and
recursive evolution queries. Four new challenges cover Charizard's profile and
dual-type weaknesses, Pokémon faster than Pikachu, and Lucario's abilities.
Charizard's type-chart multipliers combine both defending types and deliberately
exclude abilities and other battle conditions.

Existing exercise IDs remain unchanged, preserving saved drafts and completion.
Each new prompt has a hint, a worked answer, and an alternative approach;
selecting or revealing them never executes SQL. All examples and alternatives
are checked against the original database, with fixed expected results for key
Pokémon examples in the engine tests.

## Daily mystery schedule (2026-11-17)

The default mystery is shared by UTC date and works without a backend. Schedule
v1 shuffles National Dex IDs 1–1025 once using Fisher–Yates and a fixed xorshift32
seed (`0x504f4b45`). The index is the absolute number of UTC days since 2026-01-01,
modulo 1,025 (normalized for dates before the epoch). A complete cycle is a
permutation: every consecutive 1,025-day window has unique answers. This also
guarantees uniqueness within every 365/366-day calendar year and different
answers on matching dates in adjacent years. Leap days occupy their own index.

The v1 pool, seed and epoch are frozen; adding species to the database must not
silently reshuffle published puzzles. Tests pin representative v1 assignments,
check complete cycles against the bundled database, and exhaust calendar years.
Daily saves carry their date and schedule version, validated against the target.
Random practice keeps the original round key and draft separately. Only the
latest opened daily round is stored. A midnight timer plus focus/visibility
refresh detects a new UTC date, but never retargets an open or running round.
The user can finish that round or explicitly open today's challenge. Reload
opens the current UTC day when the mystery is selected and never replays SQL.

## Who’s That Pokémon? (2026-11-17)

The random mystery mode uses SQL as the guessing interface: exactly one returned
Pokémon id or name submits a guess; broader results remain available for research.
Clues compare the original species' type slots, generation, height and weight.
Matching traits alone cannot win because different species may share all five.
Each query uses a fresh original, read-only database in the existing Worker.
The target is kept outside that SQL connection, so SQL cannot select a secret
answer table. Local round state and a separate draft survive cancellation and
reload without replaying SQL. This is offline practice, not an anti-cheat system;
the target and saved notebook can be inspected in local storage. Random practice
keeps its own round; daily challenges follow the schedule above.

## Implementation update (2026-09-15)

The sections below this update describe the original design and are historical.
The web/desktop, persistence, offline, and challenge backlog items have now been
implemented as follows:

- **Desktop:** Electron wraps the same production Vite build. It uses a secure
  local `pokesql://app` scheme, a sandboxed renderer, no Node integration, no
  preload bridge, denied permissions and external requests, and a restrictive
  content security policy. Portable Windows x64 EXE and NSIS installer are built
  with electron-builder. This replaces the tentative Tauri plan: the existing
  Node toolchain can build it without adding Rust/C++ prerequisites. The tradeoff
  is a larger download because Chromium is bundled. See the official
  [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
  and [Windows packaging options](https://www.electron.build/v26/docs/win/).
- **Offline:** all 1,025 sprites are committed under `web/public/sprites`.
  The SQLite artifact remains untouched; rendering maps known source URLs to
  those files. Production builds verify sprite coverage and generate a complete
  cache list, including Worker JS and WASM. Service worker caches are isolated
  by deployment scope. Static asset lookups ignore `Vary: Origin` because hosts
  can give module-script requests a different Origin header from precache
  requests. The app reports readiness only after installation. Desktop needs
  no service worker and works offline immediately.
- **SQL execution:** moved into a dedicated Worker with manual Stop and an
  eight-second deadline. A cap on returned rows alone cannot stop an expensive
  aggregate, sort, or recursive query. On interruption, the Worker is terminated
  and recreated from the last completed snapshot; SQL is never replayed.
- **Persistence:** IndexedDB stores database snapshots; localStorage stores
  per-exercise drafts, named queries, 30 distinct recent runs, and completion
  progress. SQL errors can follow successful statements, so the changed schema
  and committed state are still captured. Reset saves the original bytes and
  leaves drafts/progress alone. Explicit transactions remain open across runs;
  checkpointing waits for COMMIT or ROLLBACK. Because sql.js export reopens the
  connection, temporary objects/attachments pause autosaving instead of silently
  destroying session state. `foreign_keys` is preserved across exports; other
  connection PRAGMAs are session settings and may reset at checkpoints. Saves
  belong to a browser profile/origin; desktop has a separate profile. Tabs do
  not merge simultaneous edits.
- **Challenges:** eight exercises progress through filters, sorting, NULLs,
  grouping, joins, self-joins and window functions. Grading runs the answer and
  reference against fresh copies of the original database. One SELECT/WITH
  statement is allowed, with SQLite query_only as an additional write guard.
  Aliases can differ; column position, value types, duplicate rows and NULLs
  must match. Row order matters only when the prompt requests it. This is local
  learning feedback, not an anti-cheat system; solutions ship with the app.
- **Verification:** Playwright tests cover dataset integrity, original samples,
  grading semantics, persistence/reset, transactions, temp tables, cancellation,
  deadlines, offline reload/sprites, unusual identifiers, broken views, narrow
  layouts, and a hidden Electron smoke test. Empty-table headers now have an
  explicit column scope for accessibility. Screenshots are stored in ignored
  test output. The dependency audit was clean after updating nanoid.

Remaining ideas: more challenge content,
database import/export, native mobile packaging, alternate-form sprites, and moves.
No signing certificate or automatic app updater is configured. The Vite build
still reports a large editor bundle warning; it is pre-cached for offline use.

Working notes from the initial build (2026-08-03). CLAUDE.md has the short
version; this is the reasoning.

## Data source research

Options considered:

| Source | Verdict |
|---|---|
| **PokeAPI CSV dumps** (github.com/PokeAPI/pokeapi, `data/v2/csv/`) | **Chosen.** The canonical dataset behind pokeapi.co, already relational (it *is* a SQL dump), always current (has all 1025 species through Gen IX), no rate limits, plain HTTPS downloads. |
| PokeAPI REST API | Same data but ~1000+ HTTP requests to assemble; slow and rude. Right choice only if we later want flavor text per version. |
| Kaggle "Complete Pokémon" CSVs | Convenient single file but frozen at whatever gen the author stopped, inconsistent column conventions, licensing unclear. |
| veekun/pokedex | The ancestor of PokeAPI's data; less maintained now. |

Sprites: hotlinked from `github.com/PokeAPI/sprites` by dex number
(`sprites/pokemon/{id}.png`, 96×96 pixel art). Official artwork also exists at
`sprites/pokemon/other/official-artwork/{id}.png` (475×475) if we want a
detail view. For a fully-offline app build these should be vendored — ~1025
small PNGs, a few tens of MB.

The Pokémon-Wordle-style fields (type, generation, height, weight, stats) all
made it into the `pokedex` view, so a Wordle mode has everything it needs.

## Why sql.js (and not…)

Requirement: no cloud database, works as a static site, and the same code
should carry to an app version.

- **sql.js** (SQLite → WASM): real SQLite in the browser, synchronous API,
  ~660 KB wasm. The DB is just a file fetched at startup. Mutations are
  in-memory only → free "Reset DB" and zero risk. **Chosen.**
- DuckDB-WASM: more impressive analytics engine, but ~10× the download, async
  API, and its SQL dialect diverges from the SQLite everyone learns first.
  Could be a later "hard mode".
- Backend (Express + better-sqlite3, or Postgres in Docker): real client/server
  feel and would allow PostgreSQL dialect practice, but violates the
  no-server goal and kills the static-hosting story.

Practical notes learned during the build:
- Vite serves the wasm via `import wasmUrl from "sql.js/dist/sql-wasm.wasm?url"`
  + `locateFile` — no manual copying.
- `db.exec()` returns one result set per SELECT statement, `[]` for pure DML —
  the UI handles both.
- Multi-statement input works fine (see the "Try writing data!" sample).

## Web + app strategy

Decision: **web-first, wrap later**. The SPA has no server dependency at all,
which makes both wrappers trivial:

- **Desktop**: Tauri (Rust shell, ~3 MB installers, WebView2 on Windows).
  `npm create tauri-app` can adopt an existing Vite app; point it at `web/`.
- **Mobile**: Capacitor wraps the built `dist/` directly.
- Either way the only real work is vendoring sprites for offline use and
  possibly persisting user edits (sql.js can export the DB to bytes →
  save to localStorage/filesystem).

Deliberately NOT React Native / Flutter: would fork the codebase for zero
benefit — this is a text-and-tables app, perfect webview material.

## Schema decisions

- **Default forms in the species table** (ids < 10000, `is_default = 1`): keeps `pokemon.id`
  equal to the National Dex number, which is the mental model everyone has.
  Alternate forms (Megas, Alolan/Galarian, Deoxys forms…) live in the separate
  `pokemon_forms` table to preserve the 1-row-per-dex-number invariant.
- **Wide stats, normalized relationships** (the key tension): a fully
  normalized `pokemon_stats(pokemon_id, stat_id, value)` table is better pivot
  practice but miserable for casual browsing. Wide won. If pivot practice is
  wanted later, add the normalized table *alongside* — the DB is tiny.
- `total_stats` is precomputed (it's the standard "BST" number Pokémon players
  know) even though it's derivable — nice for beginners before they learn
  expressions.
- `type_matchups` stores the full 324-cell matrix including 1.0 rows, so
  aggregate queries ("average damage taken by type") work without gap-filling.
- Habitat is NULL for Gen 4+ (the source data only covers FireRed/LeafGreen
  era) — kept anyway because real datasets have exactly this kind of hole, and
  it forces honest NULL handling.

## Ideas backlog

- **Challenge mode** (the big one): sidebar of prompts like "Find the 3 fastest
  Ghost types". Grading: run the hidden solution query, run the user's query,
  compare result sets (order-insensitive unless the prompt says ORDER BY;
  column-name-insensitive). Store challenge definitions as JSON. Progression:
  SELECT → WHERE → aggregate → JOIN → self-join → window.
- **Pokéwordle mode**: pick a daily hidden Pokémon (seed = date), let the user
  *query their way to it* — each guess costs a query, show the classic
  green/yellow feedback on type/gen/height/weight/stats. SQL-flavored twist on
  the existing game.
- EXPLAIN QUERY PLAN viewer (sql.js supports it) for an "under the hood" tab.
- Query history (localStorage ring buffer) + shareable query URLs
  (`?q=` base64).
- Moves + learnsets for serious JOIN practice (would grow the DB to ~10 MB —
  consider making it a second optional .sqlite the user can load).
- Persist user's modified DB across reloads (export bytes → IndexedDB) with a
  "factory reset" option.
- Light theme / Pokédex-red theme toggle.

## Post-build review (same day)

A 14-agent review pass (4 parallel reviewers + adversarial verifiers per
finding) confirmed and fixed:

- **Reset DB re-ran the editor's SQL after restoring** — following the app's
  own "Try writing data!" tutorial, reset re-applied the UPDATE it had just
  undone. Reset now shows a "database restored" notice and leaves the editor
  untouched.
- **No guard against runaway queries** — `db.exec` materialized a 1M-row
  accidental cross join (~1 GB heap, multi-second UI freeze). `runQuery` now
  uses `iterateStatements` and stops at 2,000 rows/statement, flagged in the
  status bar. Bonus: zero-row SELECTs now show their column headers.
- **Interrupted CSV downloads poisoned the cache** — `urlretrieve` left
  partial files that later runs accepted. Downloads now go to a `.part` temp
  file renamed into place, with a 30 s timeout.
- **Egg groups stored raw identifiers** ('water1', 'humanshape') — now mapped
  through `egg_group_prose.csv` to display names ('Water 1', 'Human-Like').
- **`ORDER BY generation` sorted Gen IX between IV and V** (text sort) — the
  pokedex view now exposes `generation_id` and the window-function sample
  orders by it (and teaches the trap in a comment).
- **Orphan 'stellar' type** — excluded; `types` is now exactly the 18 types
  that appear in `type_matchups`.
- **Vite 5 → 7** — cleared all npm audit findings (two were Windows-specific
  dev-server CVEs); `npm audit` is now clean.
- Smaller: pokeball.svg referenced via `BASE_URL` (survives non-root deploys
  and app wrappers), idempotent `initDb` (StrictMode double-mount), sidebar
  `<button>` moved out of `<details><summary>` (axe nested-interactive
  violation) with an explicit disclosure marker, sticky result headers
  actually stick now (scroll container moved to `.table-scroll`),
  `*.sqlite binary` in .gitattributes.

Still open (deliberate): no LICENSE file — needs a decision on MIT-for-code +
data-disclaimer vs keeping the repo private.

## Verification done at build time

- 1025 rows, 9 generations, counts per gen match Bulbapedia (151/100/135/107/
  156/72/88/96/120).
- Spot checks: Charizard fire/flying 1.7 m 90.5 kg evolves from Charmeleon;
  ice/dragon/fairy are the types super-effective vs dragon; Charmander →
  Charmeleon → Charizard self-join works; Snorlax abilities Immunity/Thick
  Fat/Gluttony; Regieleki is the fastest Pokémon (speed 200). All correct.
- End-to-end browser test (headless Chrome via playwright-core driving the
  dev server): DB loads, sprites render, sample-query clicks work, Ctrl+Enter
  executes, no console errors.
