# Verification recipes

Commands below run from `web/`. Re-check `package.json`, test names and the
Playwright configurations if the application has changed.

## Build and automated checks

- `npm.cmd run build`: type-checks, checks architecture boundaries, verifies bundled assets, builds production
  files and generates the offline cache. Do not substitute a dev server for
  this check when reviewing offline behavior.
- `npm.cmd test`: builds fresh and runs the engine/browser suite in installed
  Chrome. The runner starts and stops its own preview server on port 4175.
- For a focused run, first build, then use
  `npm.cmd exec -- playwright test tests/browser/app.spec.ts --grep "checks challenges"`.
  This exercises grading against original data after the practice DB is modified
  and checks that completion persists across reload.
- `npm.cmd exec -- playwright test tests/browser/app.spec.ts --grep "saves editor"`
  checks saved SQL, named queries, history, DB writes and reset across reload.
- `npm.cmd exec -- playwright test tests/browser/app.spec.ts --grep "works offline"`
  proves cached production assets, sprites and SQL remain usable offline.
- `npm.cmd run test:desktop` uses the separate desktop config and disposable
  profiles. To check an existing package, set `POKESQL_EXECUTABLE` to its absolute
  executable path first. Otherwise inspect the test's launch path before running.

## Feature map and manual entry points

| Feature | User path | Observable proof | Existing coverage |
| --- | --- | --- | --- |
| SQL and saved work | Edit `.cm-content`, use the Run button, save a query, reload | Modified data remains; the draft is restored without being executed | `tests/browser/app.spec.ts`, `tests/engine/sql.spec.ts` |
| Challenges | Challenges, First partners, edit answer, Check answer | Correct result and saved completion; practice DB remains independent | `tests/browser/app.spec.ts`, `tests/browser/ui-regressions.spec.ts` |
| Recovery | Run expensive SQL, Stop query, then query the last saved edit | Worker recovers to its completed snapshot and accepts another query | `tests/browser/app.spec.ts`, `tests/browser/stress.spec.ts` |
| Offline | Wait for Available offline on a production preview, disconnect, reload | Query results and a loaded sprite are still available | `tests/browser/app.spec.ts`, `tests/browser/offline.spec.ts` |

For interactive checks, start a separate strict-port production preview and use
an isolated browser context/origin with the available browser tool. Record the
process handle and port, capture before/after evidence, and close the owned tab
and server afterward. Destructive SQL and Reset DB belong only in that disposable
workspace. Use `SELECT name FROM pokemon WHERE id = 1;` for a non-destructive
query check; the original data returns Bulbasaur.

Existing Playwright traces are retained on failure, not on success. For a
successful run that needs a replayable trace, add `--trace on` to the focused
test command. Check that evidence exists before reporting a proof.
