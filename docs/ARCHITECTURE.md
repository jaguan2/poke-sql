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
      components/           Sidebar and schema-aware SQL editor
      database/
        client.ts           Worker lifecycle, timeout, cancellation, snapshots
        worker.ts           Feature-aware SQL command dispatcher
        protocol.ts         Typed worker request/reply contract
    features/
      practice/             Samples, challenges, worked answers, SQL guide
      mystery/              Random/daily rounds, grading, clues, UTC rollover
      pokedex/              Encounters, journal, achievement goals and UI
      music/                Player, styles, curated track manifest
      settings/             Settings UI, theme manifest and color variables
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

- **App composes features.** Workspace navigation and commands belong in
  `app/`; feature modules do not import the application controller.
- **Features own their behavior.** Keep feature components, their CSS, data,
  domain types, and hooks in the same feature directory. Pure domain code
  should not depend on React components or the worker transport protocol.
- **Shared code has no feature dependencies.** A helper belongs in `shared/`
  when multiple consumers need it and it has no application-specific ownership.
  For example, both the mystery notebook and collection use `PokemonProfile`;
  the collection and SQL results use the same type badge.
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
configuration, keyboard bindings and schema completion. Each draft retains its
own editor identity so delayed editor updates cannot overwrite another draft.
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
Malformed collection rows are recovered individually; exact original save bytes
are preserved in `pokesql:encounters-recovery` before a recovered collection is
written. A failed backup prevents overwriting the original collection.
