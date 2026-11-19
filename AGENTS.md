# PokéSQL

A SQL practice IDE that runs queries against a Pokédex database — built for
refreshing SQL skills with data that's actually fun to query. Everything runs
locally: no cloud database, no backend server.

Primary screens are desktop/laptop browsers and iPads in portrait or landscape.
Prioritize a comfortable SQL editor, touch controls and keyboard access there.
Phones are a basic responsive fallback, not a primary SQL-writing experience.
Use desktop/tablet views for the application gallery and feature verification.

## Architecture

```
scripts/build_db.py        Python ETL -> web/public/pokemon.sqlite
scripts/vendor_sprites.mjs Vendored species and theme sprites
data/raw/                  Cached CSV downloads (gitignored)
web/
  public/                  Database (~848 KB), sprites, music and credits
  src/main.tsx             React entry point
  src/app/                 App composition, workspace controller and editor
    database/client.ts     Worker lifecycle, timeout and snapshots
    database/worker.ts     SQL execution and isolated feature checks
    database/protocol.ts   Worker message contract
    use-safari.ts          Expedition state and asynchronous catch replies
  src/features/
    practice/              Samples, challenges, worked answers and SQL guide
    mystery/               Daily/random rounds, grading and clue UI
    pokedex/               Encounters, personal journal and achievements
    music/                 Player, styles and curated track manifest
    profiles/              Trainer card, model selection, preferences and palettes
    pc/                    Individual catches, 30-slot boxes and profile highlights
    safari/                Biome maps, encounters and SQL catch assignments
  src/shared/
    sql/                   Execution, schema introspection and result types
    storage/               IndexedDB snapshots and localStorage helpers
    pokemon/               Shared profiles, validation and type badges
    ui/                    SQL results rendering
    offline.ts             Service worker registration/status
  desktop/                 Sandboxed Electron shell (pokesql://app)
  scripts/                 Architecture/assets checks and offline cache build
  tests/                   engine/, browser/, desktop/ and shared fixtures/
```

The SQL engine is **sql.js** (SQLite compiled to WASM). The entire database is
fetched into browser memory at startup — queries never leave the page, and
destructive statements (`UPDATE`/`DROP`) are harmless because "Reset DB"
restores the original bytes. SQL runs in a Web Worker; completed snapshots
persist in IndexedDB. Editor drafts, history, saved queries and completion
progress use localStorage. Safari sessions use a separate localStorage key;
only a correct SQL catch task registers a Safari discovery in the journal. Reload never executes the saved editor contents.

PC ownership uses a separate `pokesql-collection-v1` IndexedDB database. Stable
reward IDs deduplicate wins; captures and unique box/slot placements commit in
one transaction. A per-reward localStorage outbox bridges capture commits and
the existing game saves. Retry pending captures without rerunning SQL. The app
reconciles interrupted game/journal updates from committed captures. Preserve
legacy backups, unknown imported capture fields and the six-owned-Pokémon
profile limit. SQL practice/reset never changes PC ownership or highlights.

## Commands

```powershell
py scripts/build_db.py            # rebuild the database (uses cached CSVs)
py scripts/build_db.py --refresh  # re-download CSVs from PokeAPI first

cd web
npm install
npm run dev                       # dev server at http://localhost:5173
npm run build                     # type-check + architecture/assets checks + build
npm run check:architecture        # dependency boundaries and runtime cycles
npm run sprites                   # fetch missing sprites; -- --refresh replaces them
npm test                          # engine + browser checks (installed Chrome)
npm run desktop                   # build and open Electron
npm run desktop:build             # Windows x64 portable EXE + NSIS installer
npm run test:desktop               # hidden desktop smoke test
```

Use Node >=22.12. Run the build and relevant Playwright checks after changes.
Use npm.cmd if PowerShell execution policy blocks npm.ps1. Desktop tests can
target an existing package with POKESQL_EXECUTABLE. Test data uses isolated
profiles under web/test-results; never run tests against a user's live profile.

## Database schema

One row per species, default form only, `pokemon.id` = National Dex number
(1–1025, Gens I–IX). Tables: `pokemon` (wide: stats, height_m, weight_kg,
genus, color, habitat, legendary flags, `evolves_from_id` self-reference),
`types`, `pokemon_types`, `abilities`, `pokemon_abilities`, `egg_groups`,
`pokemon_egg_groups`, `generations`, `type_matchups` (the 18×18 effectiveness
chart), plus a flattened **`pokedex` view** (type1/type2 columns, generation
name + `generation_id` for chronological sorting, evolves_from name) as the
beginner-friendly entry point.

Both species entry points include Mega flags/counts, regional-form availability,
`evolution_stage` and `can_evolve`. Stages include babies and follow species
links, including regional-only branches; Megas do not add stages. The view also
exposes capture rate, color, habitat, baby status and other existing metadata.
`pokemon_forms` holds separate form records (source form IDs), linked by
`species_id`, with names, dimensions, stats, flags and introduction generation
and version group. `pokemon_form_types` and `pokemon_form_abilities` hold form
links. Main generation is species debut; form introduction is separate. Types
use form overrides where supplied; stats/abilities inherit from source varieties.
Older saved practice databases remain intact until the explicit update/reset
action. `PRAGMA user_version` identifies the bundled schema revision.

Deliberate schema choices — keep these unless there's a reason not to:
- Base stats are **wide columns** on `pokemon` (hp…speed, total_stats), not a
  normalized stats table — friendlier for practice and Wordle-style filtering.
- Types/abilities/egg groups stay **normalized** so JOIN practice is real.
- NULLs are intentional teaching material: `type2` (single-type Pokémon),
  `habitat` (only recorded Gens 1–3), `evolves_from_id` (base forms).
- Units are converted at build time: height decimetres→m, weight hectograms→kg.
- `types` holds exactly the 18 canonical types — 'stellar' (a Tera gimmick
  with no species or matchup data) and 'unknown'/'shadow' are excluded so the
  table always joins cleanly against `type_matchups`.
- Lookup names come from PokeAPI's English name CSVs (`ability_names.csv`,
  `egg_group_prose.csv`), not raw identifiers — 'Water 1', not 'water1'.
- `MAX_RESULT_ROWS` is 2,000 per statement, with at most 50 statements per run.
  The worker has an eight-second timeout and a Stop button. Cancellation
  restores the last completed snapshot; never automatically replay SQL.

## Conventions

- The DB is a build artifact: **never hand-edit `pokemon.sqlite`** — change
  `scripts/build_db.py` and rebuild. The CSV cache in `data/raw/` is
  gitignored; the sqlite file is committed so a fresh clone runs without
  Python.
- Data source is PokeAPI's CSV dumps
  (`raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`); sprites
  are downloaded from the PokeAPI sprites repo by scripts/vendor_sprites.mjs.
  The database's source sprite URLs are mapped to bundled PNGs by ResultsTable;
  do not introduce a runtime network fallback.
- Frontend is plain CSS (`web/src/app/App.css` plus colocated feature CSS)
  with CSS variables — no UI framework. Pokémon type colors live in
  `web/src/shared/pokemon/TypeBadge.tsx`.
- Keep UI copy brief and functional. Prefer familiar Pokémon terms; avoid
  invented slogans, repeated taglines and decorative subtitles.
- Keep feature behavior in `src/features/`, reusable code in `src/shared/`, and
  cross-feature composition in `src/app/`. Shared code must not import features
  or app; features must not import app. The build enforces these boundaries.
  See [the architecture guide](docs/ARCHITECTURE.md).
- CodeMirror autocomplete is schema-aware: worker replies refresh the schema
  even after a partial SQL failure. Quote identifiers; broken views after DROP
  practice must not prevent access to the remaining tables.
- sql.js export reopens its connection. Never export with an open transaction,
  temporary objects, or attachments. Preserve supported connection PRAGMAs
  across checkpoints. SQL connection counters such as last_insert_rowid() reset;
  inspect them in the same script as their modifications. Tests cover COMMIT/ROLLBACK.
- Challenge queries use isolated original databases with query_only enabled.
  Compare aliases loosely, but preserve column order, value types, NULLs and
  duplicates. Only ordered exercises require matching row order.
- The Electron renderer has no Node integration or privileged preload API.
  Keep its sandbox, CSP, permission denials, navigation guard, and local-only
  resource loading intact. Web and desktop share the production frontend.
- Offline assets are generated from the complete dist tree at build time.
  Never hand-maintain a cache list; keep cache cleanup scoped to this deployment.

## Roadmap / not yet built

- More exercises, database export/import, and
  workspace sync between devices (currently deliberately local and separate).
- **Moves data**: PokeAPI has `moves.csv` / `pokemon_moves.csv` (~600k rows) —
  skipped in v1 to keep the DB small.
- Alternate-form sprites; form metadata is already available for SQL practice.

See NOTES.md for the full design rationale and data-source research.


## Agent engineering workflow

For substantive feature, bug-fix or refactor work, read
[the engineering skill](.agents/skills/pokesql-engineering/SKILL.md).
Trace/reproduce the behavior, implement, apply
[structural self-review](.agents/skills/pokesql-thermonuclear-review/SKILL.md)
to the actual diff, fix supported issues within the requested scope, then
[verify](.agents/skills/pokesql-verify/SKILL.md). Review design changes again;
failed checks return to investigation. Reuse valid evidence for unchanged code
and skip this loop for documentation-only or trivial cosmetic changes.
Standalone review requests remain report-only. These project adapters use the
shared agent toolkit; the tested revision is pinned in `.agents/toolkit.json`.
Installation, fallback resolution and updates are documented in
[the skill guide](docs/AGENT_SKILLS.md). Repository/user rules take precedence
over upstream model-provider, delegation, rebasing and commit examples.
