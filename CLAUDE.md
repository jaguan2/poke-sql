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
  src/db.ts               sql.js wrapper: init/run/reset + schema introspection
  src/samples.ts          Sample queries shown in the sidebar (easiest -> hardest)
  src/App.tsx             Layout, editor, query execution state
  src/components/         Sidebar (schema browser), ResultsTable (type badges, sprites)
```

The SQL engine is **sql.js** (SQLite compiled to WASM). The entire database is
fetched into browser memory at startup — queries never leave the page, and
destructive statements (`UPDATE`/`DROP`) are harmless because "Reset DB"
restores the original bytes.

## Commands

```powershell
py scripts/build_db.py            # rebuild the database (uses cached CSVs)
py scripts/build_db.py --refresh  # re-download CSVs from PokeAPI first

cd web
npm install
npm run dev                       # dev server at http://localhost:5173
npm run build                     # type-check (tsc --noEmit) + production build
```

There is no test suite yet. Verify changes by running `npm run build` and
loading the app.

## Database schema

One row per species, default form only, `pokemon.id` = National Dex number
(1–1025, Gens I–IX). Tables: `pokemon` (wide: stats, height_m, weight_kg,
genus, color, habitat, legendary flags, `evolves_from_id` self-reference),
`types`, `pokemon_types`, `abilities`, `pokemon_abilities`, `egg_groups`,
`pokemon_egg_groups`, `generations`, `type_matchups` (the 18×18 effectiveness
chart), plus a flattened **`pokedex` view** (type1/type2 columns, generation
name, evolves_from name) as the beginner-friendly entry point.

Deliberate schema choices — keep these unless there's a reason not to:
- Base stats are **wide columns** on `pokemon` (hp…speed, total_stats), not a
  normalized stats table — friendlier for practice and Wordle-style filtering.
- Types/abilities/egg groups stay **normalized** so JOIN practice is real.
- NULLs are intentional teaching material: `type2` (single-type Pokémon),
  `habitat` (only recorded Gens 1–3), `evolves_from_id` (base forms).
- Units are converted at build time: height decimetres→m, weight hectograms→kg.

## Conventions

- The DB is a build artifact: **never hand-edit `pokemon.sqlite`** — change
  `scripts/build_db.py` and rebuild. The CSV cache in `data/raw/` is
  gitignored; the sqlite file is committed so a fresh clone runs without
  Python.
- Data source is PokeAPI's CSV dumps
  (`raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`); sprites
  are hotlinked from the PokeAPI sprites repo by dex number.
- Frontend is plain CSS (web/src/App.css) with CSS variables — no UI
  framework. Pokémon type colors live in `ResultsTable.tsx`.
- CodeMirror autocomplete is schema-aware: it's rebuilt from `getSchema()`
  after every query so `CREATE TABLE` practice shows up immediately.

## Roadmap / not yet built

- **App version**: wrap `web/` with Tauri (desktop) or Capacitor (mobile) —
  the SPA is fully self-contained (WASM + sqlite bundled), so it should work
  offline once sprites are vendored locally.
- **Challenge mode**: prompts with expected result sets, checked by comparing
  the user's query output (see NOTES.md for design sketch).
- **Moves data**: PokeAPI has `moves.csv` / `pokemon_moves.csv` (~600k rows) —
  skipped in v1 to keep the DB small.
- Alternate forms (Megas, regional variants) — pokemon.csv rows with
  `is_default = 0` and ids ≥ 10000, currently skipped.

See NOTES.md for the full design rationale and data-source research.
