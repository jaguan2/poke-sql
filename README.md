# PokéSQL 🔴⚪

Practice real SQL with 1,025 Pokémon from Generations I–IX. Explore types,
stats, evolutions, abilities, and the type-effectiveness chart in a web app
or a Windows desktop application. No account, cloud database, or backend.

## Start the web app

Use Node.js 22.12 or newer (Node 24 recommended).

```powershell
cd web
npm install
npm run dev
```

Open http://localhost:5173. If PowerShell blocks `npm.ps1`, use `npm.cmd`
in place of `npm` in these commands.

## Windows application

```powershell
cd web
npm install
npm run desktop          # build and open the desktop app
npm run desktop:build    # build portable EXE and installer
```

The Windows x64 build produces:

- `web/release/PokeSQL-0.1.0-portable.exe` — launch without installation.
- `web/release/PokeSQL-0.1.0-setup.exe` — install for your Windows user.

The desktop build uses Electron and includes the database, SQLite engine,
and all sprites. It works offline from the first launch. Building requires
internet access to download npm dependencies and Windows packaging tools;
the finished app does not. Builds are unsigned; no signing certificate is
configured. The portable EXE still saves its workspace in the Windows user
profile, so moving the EXE does not move your saved work.

## Practice tools

- **SQL editor:** SQLite syntax highlighting, schema autocomplete,
  Ctrl+Enter / Cmd+Enter, and multiple statements.
- **Explore:** 11 examples, from simple filters to self-joins and window functions.
- **Challenges:** eight guided exercises with hints, result checking, and saved
  completion progress. Answers use a fresh copy of the original Pokédex.
- **Saved work:** separate editor drafts for free practice and each challenge,
  named queries, and the last 30 distinct query runs.
- **Database saves:** completed changes persist locally in IndexedDB. Reset DB
  restores and saves the original database, keeping your SQL and progress.
- **Responsive execution:** SQL runs in a Web Worker. Stop interrupts a query;
  an eight-second timeout also catches expensive queries. Recovery restores the
  last completed snapshot, discarding unsaved changes from the interrupted run.
- **Results:** Pokémon sprites, type badges, explicit NULLs, and empty-result
  column headers. Up to 2,000 rows are fetched per statement, with pagination
  displaying 500 at a time.

SQL transactions work across runs. An open transaction is not saved until
COMMIT. Temporary objects and attached databases stay in the live session;
automatic saves pause until you drop the temporary objects and detach the
databases. Notices explain when saving is paused or unavailable.

Autosave preserves supported connection PRAGMAs, but sql.js reopens the
connection when exporting a snapshot. Read `last_insert_rowid()`, `changes()`,
or `total_changes()` in the same SQL script as the modifications they describe;
these connection counters reset between saved runs.

Work is local to the current browser profile and site address (or desktop
profile); web and desktop saves are separate. Clearing site data removes
saved work. Use one tab per workspace: simultaneous tabs do not merge edits.

## Production web build and offline access

```powershell
cd web
npm run build
npm run preview
```

Deploy the contents of `web/dist/` to a static HTTPS host. Relative asset
paths support deployment in a subdirectory. Opening `index.html` directly
with `file://` is not supported; use the preview server or desktop EXE.

On the first online visit, the production app caches its complete bundle,
database, and all sprites. Wait for **Available offline** before disconnecting.
Offline caching needs HTTPS or localhost and sufficient browser storage;
development mode does not install a service worker. When an update is ready,
close all PokéSQL tabs and reopen the site.

## Data and assets

The SQLite database and 1,025 local sprites ship with the repository. Python
is only required to rebuild the dataset:

```powershell
py scripts/build_db.py --refresh
cd web
npm run sprites          # download any missing sprites for the rebuilt DB
```

The sprite downloader validates PNG headers, retries failures, and uses atomic
file replacement. `npm run sprites -- --refresh` re-downloads existing sprites.
Every production build verifies that all database species have a local sprite.

## Verification

```powershell
cd web
npm run build
npm test                 # builds fresh, then database + Chrome browser tests
npm run test:desktop     # hidden Electron smoke test
```

Browser tests use an installed Google Chrome. The suite checks persistence,
reset, isolated grading, explicit transactions, temporary tables, cancellation,
timeouts, offline reload, sprites, unusual table names, and responsive layout.
To test a packaged build, set `POKESQL_EXECUTABLE` to the absolute path of
`web/release/win-unpacked/PokeSQL.exe` before running `npm run test:desktop`.

See [CLAUDE.md](CLAUDE.md) for development guidance and [NOTES.md](NOTES.md)
for architecture decisions and remaining ideas.

Data from [PokeAPI](https://pokeapi.co/), its
[CSV dumps](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv), and
[sprites repository](https://github.com/PokeAPI/sprites).
Pokémon and Pokémon character names are trademarks of Nintendo. This is an
unofficial educational fan project, not affiliated with or endorsed by
Nintendo, Game Freak, or Creatures.
