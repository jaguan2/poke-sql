# Design notes

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

Remaining ideas: a daily Pokémon mystery/Wordle game, more challenge content,
database import/export, native mobile packaging, and additional forms/moves.
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

- **Default forms only** (ids < 10000, `is_default = 1`): keeps `pokemon.id`
  equal to the National Dex number, which is the mental model everyone has.
  Alternate forms (Megas, Alolan/Galarian, Deoxys forms…) would break the
  1-row-per-dex-number invariant; if added later they should be a separate
  `pokemon_forms` table.
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
