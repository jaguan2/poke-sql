# PokéSQL 🔴⚪

Practice SQL by querying the Pokédex. A browser-based SQL IDE with a real
SQLite database of all 1,025 Pokémon (Generations I–IX) — types, stats,
evolutions, abilities, and the full type-effectiveness chart.

Runs 100% locally: the database is SQLite compiled to WebAssembly, living
entirely in your browser tab. No server, no cloud, and `DROP TABLE` is a
learning experience instead of a disaster (there's a Reset button).

## Quick start

```powershell
cd web
npm install
npm run dev     # -> http://localhost:5173
```

The prebuilt database ships with the repo. To rebuild it from PokeAPI's
latest data:

```powershell
py scripts/build_db.py --refresh
```

## What's inside

- **Editor**: CodeMirror with SQL syntax highlighting, schema-aware
  autocomplete, and Ctrl+Enter to run.
- **Schema browser**: click any table to peek at it.
- **Sample queries**: a ladder from `SELECT *` up to self-joins and window
  functions.
- **`pokedex` view**: the friendly flat starting point — one row per Pokémon
  with types, stats, generation, and sprite.

Data from [PokeAPI](https://pokeapi.co/) ([CSV dumps](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)).
Pokémon and Pokémon character names are trademarks of Nintendo.
