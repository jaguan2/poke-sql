# Windows releases and updates

Git contains source and bundled game/data assets. Generated EXEs, payloads and
update metadata belong in GitHub Release downloads. Users do not need Node,
Python or a checkout to install the application.

## Build and verify locally

From `web/`, with Node 24:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:updates
npm.cmd run desktop:build
$env:POKESQL_EXECUTABLE = (Resolve-Path release/win-unpacked/PokeSQL.exe).Path
npm.cmd run test:desktop
```

`desktop:build` verifies installer/payload SHA-512 hashes, version metadata,
small-installer size and the packaged GitHub update configuration. The public
renderer remains sandboxed and local-only. Tests use separate profiles and
updater caches under `web/test-results`; they never execute downloaded updates.

The outputs for 0.2.7 are:

| File | Purpose |
| --- | --- |
| `web/release/nsis-web/PokeSQL-0.2.7-setup.exe` | Small first-time installer |
| `web/release/nsis-web/poke-sql-web-0.2.7-x64.nsis.7z` | Downloaded application payload |
| `web/release/nsis-web/latest.yml` | Stable update feed with checksums |
| `web/release/PokeSQL-0.2.7-portable.exe` | Complete offline/manual-update build |

The installer URL targets that exact version's release. Before publication, run
it beside the matching payload to install without a remote download. A local
copy named `PokeSQL.exe` at the repository root needs the payload beside it too.
After installation, use the installed desktop/start-menu shortcut. The setup
EXE is an installer, and the installed app performs subsequent update checks.

## Publish a version

1. Run `npm.cmd version <new-version> --no-git-tag-version` from `web/` to update
   both package files. The prepared local version is `0.2.7`.
2. Commit the reviewed source, workflow and lockfile changes. Keep generated
   binaries out of the commit. Push the source normally.
3. Tag that commit and push the tag, for example:

   ```powershell
   git tag v0.2.7
   git push origin v0.2.7
   ```

4. The **Windows build and draft release** workflow runs the production
   engine/browser tests, updater tests, packaging checks and packaged desktop
   tests. It uploads the build and test evidence as workflow artifacts, then
   attaches the installer, payload, metadata and portable build to a **draft**.
5. Review the release notes and install the draft's downloaded artifacts in a
   disposable Windows test environment. Publish the draft to make that version
   visible to installed applications. Drafts are invisible to the public updater.

Main pushes, pull requests and manual workflow runs build/test artifacts without
publishing a release. Only a version-tag run creates a draft. Tags must match
`package.json` exactly, with a `v` prefix. A published version cannot be replaced
by rerunning CI; use a higher version for another release. Do not reuse version
tags. The workflow uses its scoped GitHub token only in the draft-upload job;
no GitHub credentials are included in the app.

## Update behavior and saved data

- Installed Windows builds use `electron-updater` with this public repository's
  GitHub Releases. Checks start after window creation and recur every six hours.
- Downloads and checksum validation use a separate updater network session.
  The renderer's local-resource request guard and CSP stay intact.
- A completed download announces the new version once. It installs on normal
  quit, with automatic relaunch disabled. It never forces a running query to stop.
- Offline checks, failed downloads and checksum errors do not replace the app.
  The installed version opens normally without connectivity.
- Portable, development and normal automated-test launches skip background
  production checks. The desktop update tests explicitly supply a loopback feed
  to the real updater and disable installation before any download completes.
- The application ID and Electron profile identity are unchanged. Installation
  files stay separate from SQL snapshots, drafts, settings and journal progress.
  An update never resets the practice database or clears a profile. The existing
  explicit Reset DB/update flow still controls dataset replacement.

Builds currently use the project's unsigned Windows packaging. Download hashes
are validated; publisher-signature validation remains enabled when signing is
configured. Add the appropriate electron-builder signing credentials to CI if
you adopt a Windows signing certificate.

## Corrected oversized commit

The single unpushed commit `c5922f5` was replaced with `c79da3e`, removing the
oversized EXE and adding ignore rules. The original commit is retained locally
at `refs/backups/before-release-exe-cleanup-20261118`. Source changes and the
local EXE were hash-checked before/after the amendment. Published history was
unchanged, and a normal push dry run succeeded. No force push is needed.

## Updating existing 0.2.0 downloads

1. Close PokéSQL and run the 0.2.7 setup. For a local build, keep the matching
   0.2.7 `.nsis.7z` payload beside the small installer. Use the installed shortcut
   afterward. The application ID, origin and profile directory stay the same.
2. For a portable copy, replace the portable application with the newer portable
   build. Keep its profile location intact. Do not copy application files into
   the saved-data directory.
3. Publish reviewed `v0.2.7` release assets and `latest.yml` for automatic updates
   from installed copies. Draft releases and uncommitted source changes do not
   reach installed users. Versions must increase; repeated 0.2.0 builds cannot
   trigger an automatic 0.2.0-to-0.2.0 update.

The local 0.2.7 build does not publish a release. At verification time the public
latest-release endpoint returned 404, so there is no publicly readable update
release to deliver automatically. If the source repository is private, host
release assets in an accessible distribution repository and configure the feed
there; do not ship a GitHub access token inside the application.

The isolated `tests/desktop/upgrade-profile.spec.ts` can launch an older binary
and the new package against the same disposable profile. Set
`POKESQL_PREVIOUS_EXECUTABLE` and `POKESQL_EXECUTABLE` to test real binary-version
upgrades, including SQL snapshots/drafts, PC captures, extra imported fields
and featured Pokémon. This never targets the live user profile.
