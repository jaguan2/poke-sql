# Native artwork implementation review

Baseline: `dev` at `2ee0da0`; reviewed the working diff, including the new builder,
asset manifest, UI test and generated images. The pre-existing AGENTS.md edit and
commit-review notes are outside this implementation review.

## Result

No remaining structural blockers in this scoped change. Applied the complete
Thermos rubric: responsibility/size growth, branching, abstractions, canonical
ownership, type contracts, duplicate work and partial updates. No file crosses
1,000 lines. This is a structural assessment, separate from runtime evidence.

The simpler implementation removes procedural building drawing, the authored
Sinnoh atlas and battle recoloring. A single pinned-source UI builder reuses
GameSource and emits local PNGs. One discriminated icon registry replaces separate
SVG paths and parallel image registries. Feature ownership and SQL/collection
persistence are unchanged; no renderer network fallback or Electron privilege
was added. Generated files are checked by size/hash during production builds.
Build outputs are generated before packaging, never mutated at runtime.

## Corrections and re-review

- Kept native window borders within existing compact page gutters (4 CSS pixels).
- Native PC wallpaper title/body slices now scale independently so the title
  strip sits above the first slot row. Original source pixels/palettes are kept.
- Replaced an overly repetitive bridge-approach paving crop with the native
  Cerulean walking path after inspecting the full-size Twinleaf screenshot.
- Gallery capture waits for finite CSS transitions and forces open details to
  their final size/opacity during capture, avoiding clipped transition frames.
- Removed the stale PC drop-target variable after deleting flat wallpapers.
- Made both Sinnoh overview generation paths byte-identical, including JSON
  serialization. Rebuilt 39 artifacts through each path without byte changes.
- Removed a competing header focus restore when the exploration map owns focus.
- Matched reduced-motion selector specificity to the staged entry rules; the
  offline UI checks assert there are no staged-entry animations in that mode.
- PC drag verification now scrolls Next box into view before measuring its
  hover target. The former target could be hidden behind the fixed header after
  a preceding drag scrolled the box. Mouse and touch behavior pass with visible
  controls; production drag logic did not need a change.

## Verification evidence

All paths below are local retained evidence under `web/test-results/native-assets`.

- `build-delivery-verified.log`: typecheck, architecture boundaries, asset hashes,
  production bundle and generated offline cache pass.
- `verified-ui.log`: 23 passing checks covering native artwork offline at desktop
  and portrait/landscape tablet sizes, motion, profiles, spacing and Sinnoh.
- `pc-verified.log`: 12 passing native-art/party/touch checks; its mouse hover
  failure was investigated and corrected in the test as described above.
- `delivery.log`: six final offline artwork and Sinnoh interaction checks pass
  after the paving crop correction.
- `drag-verified.log`: both complete mouse and touch drag checks pass.
- `gallery-delivery.log`: refreshed production-build desktop/tablet gallery.
- Earlier `browser.log`/`regression.log` retain passing battle layout, captures
  and ownership coverage; superseded failures are recorded, not hidden.

Visual inspection covers the native PC title/body, Trainer Card, battle text
contrast, Sinnoh map and adapted Twinleaf field art. Gallery images and source
provenance are linked from the screenshot README and NATIVE_ASSETS.md.

## Explicit limits

Sinnoh collision geometry remains authored. Its fountain, construction landmark
and turbines are still custom drawings; native DS field/model conversion is not
implemented. SQL-only icons remain application symbols. This review does not
certify all historical code, desktop installer packaging, update publication or
those remaining native DS conversions. No installer/release was produced.
