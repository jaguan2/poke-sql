# Runtime and stress check — 2026-09-20

Tested the production Vite build in installed Chrome with isolated profiles,
and the Electron shell with its isolated hidden test profile. Visually inspected
desktop and 390px mobile screenshots. No live user workspace was used.

## Measured rendering improvement

The workload runs 50 SELECT statements, each returning the 2,000-row cap with
three columns: 100,000 fetched rows in total. Previously all 50 result tables
mounted together, and editing the query name re-rendered their cells.

`QueryResults` now mounts one selected result set and memoizes unchanged results.
The selector and previous/next controls retain access to every result set;
existing row pagination retains access to every fetched row. New runs start at
the first result, and switching result sets starts at the first page.

| Measurement | Before | After |
| --- | ---: | ---: |
| Batch click to Run button available again | 1,554 ms | 170 ms |
| Rendered table cells | 75,000 | 1,500 |
| Type 16 characters in query-name input | 2,169 ms | 132 ms |
| Initial navigation to ready | 195 ms | 201 ms |

These are individual local runs with Playwright tracing, not statistical
benchmarks or guarantees for other hardware. The timing includes browser
automation and UI work, rather than just SQLite execution. After the change,
20 successive count queries took 23–49 ms each in the same test run.
Timing is recorded for investigation; tests assert correctness and bounded DOM
size rather than fragile millisecond thresholds.

## Coverage

- Production build, TypeScript checks, database integrity, and 1,025 bundled sprites.
- 50-statement / 100,000-row workload, all-result navigation, row pagination,
  20 repeated queries, oversized scripts and the 51st-statement rejection.
- Three cancel/recover cycles with uncommitted writes; saved data survives
  cancellation and reload. Main-thread animation frames continue during SQL.
- Eight-second automatic timeout and successful subsequent queries.
- Local database/WASM/sprites, offline reload, failed offline installation retry,
  and HTTP 503 database-download failure followed by successful retry.
- No external requests or uncaught page errors in the stress workload.
- Saved queries, drafts, history, challenge isolation, storage failures,
  transactions, temporary objects, broken views, and desktop/mobile layouts.
- Electron startup, bundled assets, persistence across restart, single-instance
  behavior, CSP, path handling, and renderer sandbox settings.

The restricted execution sandbox caused Electron launch and Playwright server
cleanup problems. The desktop smoke test passed outside that sandbox using the
same isolated test profile configuration.

## Follow-up candidates

1. Add a byte budget for SQL results. Row/statement caps do not bound the size of
   individual strings or blobs; this run did not probe out-of-memory limits.
2. Profile much larger saved databases before optimizing checkpoints: even SELECT
   runs currently export and persist a snapshot. Any optimization must preserve
   partial writes, schema changes, transactions, and connection PRAGMAs.
3. Profile initial loading on slower devices/connections. The main JavaScript
   bundle is about 604 KB (198.5 KB gzip); Vite emits a size warning. Splitting
   editor loading should be evaluated against added request/startup overhead.

Reproduce with `cd web`, `npm.cmd test`, and `npm.cmd run test:desktop`.
The stress test logs `STRESS_METRICS` and saves desktop/mobile screenshots under
`web/test-results`. This is a bounded local stress check, not a long-duration
memory soak or a cross-browser/device certification.
