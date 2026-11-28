# Project memory

Verified 2026-11-28 on `dev` at `2ee0da0`. `git fetch origin` confirmed local
`dev` and `origin/dev` match. This is a repository-backed context snapshot;
refresh it after relevant changes rather than treating it as timeless truth.

## Recent commits and their actual state

| Commit | Result |
| --- | --- |
| `2ee0da0` | Soft interaction treatment: activation pulses, stable shared Run/Stop controls, native details expansion, blurred icon crossfades, staged page content, Bag heading focus and personalization focus restoration. Reduced motion is respected. These changes are committed now. |
| `d240322` | Active party, domain collection schema version 2, additive migration with backup, party commands, cached collection lookups, filters/search and bounded result rendering. |
| `23b17ca` | Opt-in continuous Canvas overworld movement, Surf, connected outdoor maps and visible Pokémon that enter the existing SQL catch flow. |
| `bd1ddf3` | Revised world rendering/export pipeline; read the current manifests rather than assuming every region has the same native data pipeline. |
| `24616c3` | Historical Unova WIP. Its map implementation has subsequently been retired; do not infer current support from this commit title. |
| `9f4f06b` | Authored Sinnoh region, supported Classic terrain mechanics, encounters and regional art/credits. |
| `d588a36` | Native FireRed Bag artwork and unlimited reusable Repel supplies; durations still apply. |
| `c452e38` | Earlier map/catch integration and initial Bag/Charm foundation. |

## Current gameplay surface

- Classic exploration: Kanto 15, Hoenn 14, Johto 17 and Sinnoh 16 locations,
  plus nine Safari habitats. Region/area selection permits direct travel.
- Smooth exploration: optional, 23 exported outdoor Kanto/Hoenn maps. Classic
  remains the default and fallback. Johto, Sinnoh, caves/gates and Safari
  habitats are outside this Smooth slice. Interiors remain unimplemented.
- Unova geography/art is retired. Its 156 species, sprites and owned Pokémon
  remain. `retired-unova.ts` archives affected expeditions and returns retired
  visits/bookmarks to supported locations; it does not delete the collection.
- Sinnoh walking layouts are authored with native Gen III terrain/building crops, not extracted DS field maps. The pending native-asset update replaces its town map with original Platinum art and native location anchors.
- Smooth movement/Surf uses `features/safari/world/` pure physics/terrain/wild
  modules with a Canvas runtime. Surf is immediately available; it is not
  gated by the active party. Walking alone does not start Smooth encounters:
  choose a nearby visible Pokémon, then solve the existing SQL catch task.
- Correct SQL guarantees Smooth capture, with unlimited retries. Existing
  encounter phases, receipts, journal and PC ownership remain authoritative.
- Repel/Super Repel/Max Repel supplies are unlimited, lasting 100/200/250
  successful walking steps; active Repels cannot stack. Shiny Charm unlocks
  after ten Safari catches and changes supported shiny odds from 1/128 to 1/64.
- Bundled species sprites: 1,025 normal and 295 shiny variants. Alternate-form
  SQL metadata does not imply complete alternate-form/directional sprite art.

## Ownership and persistence decisions to preserve

- `pokesql-collection-v1` remains IndexedDB database version **1**. The collection
  domain metadata has **schemaVersion 2**; these are different version systems.
- Ordered `partyIds` contains at most six owned instance IDs; the first is the
  leader. This is separate from `featuredIds`, the six-member Trainer ID showcase.
  Party members retain canonical box placements. Ownership is instance-based.
- New collections start with 64 thirty-slot boxes; more are available and added
  automatically as necessary. Capture reward IDs and unique slot placements
  deduplicate/commit within one write transaction; the capture outbox bridges
  journal/game saves. Never replay SQL to retry a PC save.
- Domain migration and requested command share a transaction. Old metadata and
  unknown capture fields survive; unsupported future schema versions are
  rejected without overwriting data. Preserve migration/legacy backups.
- Commands read canonical current state inside their transaction, so stale tabs
  cannot exceed party limits. BroadcastChannel refreshes other tabs.
- PC UI indexes by instance, box/slot and species. It renders 30 active slots or
  an initial 60 search results, growing by 60. This is bounded rendering, not
  full collection virtualization or indexed/paged persistence.
- Every collection command still reads and validates the full collection. A real
  IndexedDB transaction-latency benchmark is the next scaling gate, not a claim
  that the persistence layer is already incremental.
- Safari continuous snapshots use an additive `exploration` field with a
  generation token to reject stale saves. SQL practice/reset remains separate
  from ownership, party, profile highlights and exploration progress.
- App/game state stays local; production assets are bundled/generated offline.
  Keep the SQL worker and Electron sandbox contracts in AGENTS.md intact.

## Not implemented by the foundation commits

Party metadata is not a battle/XP/evolution system. XP, earned levels, move
learning, evolution transactions, followers, activity rewards, Gyms, trading and
breeding remain design proposals. Recorded encounter level is capture history,
not an earned progression level. `GAMEPLAY_FOUNDATION.md` describes staged future
work as well as the shipped foundation; distinguish them before implementing.

## Latest review and follow-up order

See [2026-11-28 review](REVIEWS/2026-11-28-dev.md). Reproduced issues:

1. Smooth world hotkeys intercept Space on focused buttons.
2. A world encounter can start while Region map is open.
3. Crossing a six-tile spawn-cell boundary replaces all nearby entities in view.

Address input gating and in-session entity continuity first. Then measure real
collection write latency before adding atomic progression/item/evolution work.
Keep the existing pure physics/renderer/transaction boundaries and ship small
SQL-learning increments rather than treating all roadmap systems as implemented.

Current review evidence: production build and 39 focused engine/browser tests
passed. Three separate production-browser probes reproduced the issues above;
they are observations of defects, not passing acceptance tests for those behaviors.
No Windows installer/release or physical iPad verification was performed in this
review. Runtime code was left unchanged; the review and memory are documentation.

## Deeper references

- [Architecture](ARCHITECTURE.md)
- [Overworld scope and contracts](OVERWORLD_EXPLORATION.md)
- [Gameplay foundation and roadmap](GAMEPLAY_FOUNDATION.md)
- [World-map provenance](WORLD_MAPS.md)
- [Historical design rationale](../NOTES.md)

## Native-asset changes in the dev working tree

The working tree after this snapshot imports original FireRed/Platinum menu,
window, PC wallpaper, Trainer Card, badge and town-map artwork. It restores native
battle palettes and replaces Sinnoh's ordinary hand-drawn buildings/painted terrain
with native Gen III crops. See [asset inventory](NATIVE_ASSETS.md) for source pins,
rebuild commands and the remaining authored DS-specific props. This work is not a
new gameplay/progression implementation or a published Windows update.

Production build, offline desktop/tablet artwork, profile focus, reduced-motion
staging and PC party/drag behavior were checked. Both asset generation paths
reproduce the same files. Refreshed screenshots live in docs/screenshots. See
[implementation review](REVIEWS/2026-11-28-native-assets.md) for evidence and limits.


## Walking-map changes in the dev working tree

The subsequent walking-layout pass redesigns six Sinnoh towns with native-size
buildings and connected narrow paths. Routes 201–204 and Eterna Forest are larger,
with bends, separate grass clearings and optional branches. All remain authored
Classic maps, not extracted DS geography. Revisions advance so existing saves
return to a safe trailhead without losing progress. Kanto/Hoenn/Johto geometry,
encounter pools, music, SQL and collection ownership are unchanged. See the
walking-layout section of WORLD_MAPS.md and refreshed Sinnoh gallery photos.
