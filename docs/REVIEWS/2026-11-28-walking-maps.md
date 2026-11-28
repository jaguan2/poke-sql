# Walking-map implementation review

Scope: the second working-tree increment on dev at 2ee0da0, following the native
art migration. Reviewed Sinnoh recipe/layout/art/manifest changes and the engine,
browser and gallery tests. Previous native-art and AGENTS.md edits are retained.

## Structural review

Applied the full Thermos rubric to this increment. No remaining structural
blockers. The change uses existing declarative recipes and existing generation,
collision, portal, camera and save-revision owners. It adds no runtime mode,
wrapper, renderer branch, fallback, persistence schema or dependency. The large
route JSON remains data; no code file crosses the 1,000-line boundary. Native
building dimensions replace stretched generic footprints and unused per-building
roof/wall colors are removed from the redesigned towns.

Six towns have native-size buildings and connected paths. Routes 201–204 and
Eterna Forest expand with authored bends, groves and optional clearings. Kanto,
Hoenn and Johto field layouts and Sinnoh encounter pools remain unchanged. Layout
revisions use existing save relocation; no new migration abstraction was needed.

## Issues found and corrected

- The first forest/Route 204 groves enclosed Honey Trees. Their approaches were
  reopened. A forest footpath now reaches the Honey Tree without walking through
  the optional grass patch; engine reachability and browser encounters pass.
- The new walking fixture initially supplied an unsupported 1,000-step Repel.
  It now uses the existing 250-step maximum, rather than altering game rules.
- Large fields put lazy table sprites beyond the browser loading threshold.
  Gallery capture makes its images eager, retaining the all-images-loaded check.
  Production image loading remains lazy.
- The existing Route 201 image-width expectation now reflects its 640-pixel art.

## Evidence

Retained under web/test-results/walking-maps:

- build-final.log: typecheck, architecture/assets, production build and offline
  cache pass.
- final.log: all 11 engine/browser checks pass. They cover all region connections,
  every expanded grass clearing, Honey Trees, shiny SQL catch and PC deposit,
  legacy save relocation, and desktop/tablet-size keyboard exploration with
  camera bounds and offline restoration at the walked position.
- verified.log: native menu/PC/card/atlas offline checks passed in three viewport
  sizes; initial failures are superseded by the final run and retained.
- gallery-final.log: updated Sinnoh town/overview, Route 201 and forest captures.

Reviewed generated field art and the application captures. Changes remain
uncommitted on dev. No desktop installer or release was built. Native DS field
geometry, doors/interiors, new regions and Smooth Sinnoh are outside this pass.
