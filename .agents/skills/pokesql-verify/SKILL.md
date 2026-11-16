---
name: pokesql-verify
description: Verify PokeSQL behavior using its production build, existing Playwright browser and engine tests, or isolated Electron smoke tests, with retained evidence and owned-process cleanup.
---

# Verify PokeSQL

Use [AGENTS.md](../../../AGENTS.md). Use Node 22.12 or newer and run npm
commands from `web/`; use `npm.cmd` in PowerShell. Install locked dependencies
with `npm.cmd ci` only if needed. Do not refresh the dataset or sprites merely
to test a code change. The checked-in assets make the app runnable locally.

Choose a relevant recipe from [workflows](references/workflows.md). Start with
the smallest check that exercises the changed contract. Broaden when shared
engine/storage impact, a failure or release scope warrants it. Complete the
build and relevant checks required by AGENTS.md for source/packaging changes.
For skill/documentation-only edits, validate the changed files and references;
do not build or launch the application unless a verification recipe changed.

Reuse passing evidence for unchanged code in the same task. Repeat a check when
later edits invalidate it or an unresolved concern needs it, not for reassurance.
Prefer existing behavior coverage; add a regression test only for a contract it
does not cover. Keep evidence proportional to the claim being made.

Before driving an app, establish which checkout/build and port you own.
Playwright's configured preview uses `127.0.0.1:4175`, refuses an existing
server, and creates isolated browser contexts. Let the test runner own its
server. Do not point tests at a user's browser or desktop profile.

Capture command, scope, exit status and observable result. Preserve useful
screenshots/traces under `web/test-results/`. Passing source tests does not
prove the packaged Electron application or an offline reload; name the surface
actually checked. Never remove evidence as part of cleanup. Stop only processes
started by this verification, and do not kill apps by process name.

## Shared verification method

Use `toolkit-verify`, resolved through [toolkit setup](../../../docs/AGENT_SKILLS.md),
for evidence standards and the failure/recheck loop. The commands, isolation
rules and artifact requirements above remain this project's verification contract.
