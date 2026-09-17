# PokéSQL

A SQL practice IDE that runs queries against a Pokédex database — built for
refreshing SQL skills with data that's actually fun to query. Everything runs
locally: no cloud database, no backend server.

## Architecture

```
scripts/build_db.py   Python ETL: downloads PokeAPI CSVs -> web/public/pokemon.sqlite
data/raw/             Cached CSV downloads (gitignored, regenerable)
web/                  Vite + React + TypeScript SPA
  public/pokemon.sqlite   The database (committed; ~416 KB)
  public/sprites/         Vendored sprites (one PNG per species)
  src/db.ts               Async Worker client, cancellation and saved snapshots
  src/db.worker.ts        SQL execution, checkpointing and isolated challenge checks
  src/engine.ts           Statement execution and resilient schema introspection
  src/storage.ts          IndexedDB database saves + localStorage helpers
  src/challenges.ts       Eight exercises and result comparison
  src/offline.ts          Production service worker registration and status
  src/samples.ts          Sample queries shown in the sidebar (easiest -> hardest)
  src/App.tsx             Layout, editor, query execution state
  src/components/         Sidebar (schema browser), ResultsTable (type badges, sprites)
  desktop/main.cjs        Sandboxed Electron shell using pokesql://app
  scripts/                Asset verification and generated offline cache
  tests/                  Playwright browser, engine, and desktop tests
```

The SQL engine is **sql.js** (SQLite compiled to WASM). The entire database is
fetched into browser memory at startup — queries never leave the page, and
destructive statements (`UPDATE`/`DROP`) are harmless because "Reset DB"
restores the original bytes. SQL runs in a Web Worker; completed snapshots
persist in IndexedDB. Editor drafts, history, saved queries and completion
progress use localStorage. Reload never executes the saved editor contents.

## Commands

```powershell
py scripts/build_db.py            # rebuild the database (uses cached CSVs)
py scripts/build_db.py --refresh  # re-download CSVs from PokeAPI first

cd web
npm install
npm run dev                       # dev server at http://localhost:5173
npm run build                     # type-check (tsc --noEmit) + production build
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
- Frontend is plain CSS (web/src/App.css) with CSS variables — no UI
  framework. Pokémon type colors live in `ResultsTable.tsx`.
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

- Native mobile packaging; the responsive web app already supports narrow screens.
- More exercises, a daily SQL Pokémon mystery, database export/import, and
  workspace sync between devices (currently deliberately local and separate).
- **Moves data**: PokeAPI has `moves.csv` / `pokemon_moves.csv` (~600k rows) —
  skipped in v1 to keep the DB small.
- Alternate forms (Megas, regional variants) — pokemon.csv rows with
  `is_default = 0` and ids ≥ 10000, currently skipped.

See NOTES.md for the full design rationale and data-source research.
