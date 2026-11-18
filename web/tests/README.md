# Test organization

Run commands from `web/` with Node 22.12 or newer. Use `npm.cmd` on Windows if
PowerShell blocks `npm.ps1`.

| Directory | Scope |
| --- | --- |
| `engine/` | SQLite integrity, execution/checkpoint rules, samples, grading, daily schedule, encounter/achievement models, Safari maps/pools/grading, and forms data |
| `browser/` | Production web workflows, saved work, offline access, cancellation, themes, autocomplete, desktop/mobile layouts, Safari movement/catches, save recovery, and music |
| `desktop/` | Sandboxed Electron resource loading, persistence, mysteries, Safari assets/catches, and collection smoke checks |
| `fixtures/` | Shared test data read from the canonical bundled database |

```powershell
npm test                              # production build + engine/browser tests
npm run build
npm exec -- playwright test tests/engine
npm exec -- playwright test tests/browser/mobile-layout.spec.ts
npm run test:desktop
```

The normal runner excludes `desktop/`, owns `127.0.0.1:4175`, and refuses an
already-running server. Desktop checks use their own configuration and isolated
profiles. Set `POKESQL_EXECUTABLE` to test an actual packaged executable;
otherwise desktop checks launch Electron against the current `dist/` build.
Source-build checks do not verify the checked-in root executable.

Output and failure traces live in `web/test-results/`. Never use a user's live
browser or Electron profile. The ETL also has cache-independent Python checks:
from the repository root, run `python -m unittest scripts.test_build_db -v`.
