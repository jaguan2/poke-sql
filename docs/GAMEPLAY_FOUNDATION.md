# Gameplay foundation and progression plan

Assessment: 2026-11-27, starting from `23b17ca` on `dev`. The first increment
implements versioned collection metadata, an active party and collection lookup,
filtering and allocation improvements. This document separates that shipped
increment from proposed progression systems. See [architecture](ARCHITECTURE.md),
[overworld](OVERWORLD_EXPLORATION.md) and [map conversion](WORLD_MAPS.md).

## Inventory and gaps

| Area | Existing implementation | Gap / decision |
| --- | --- | --- |
| SQL learning | CodeMirror, completion, results, saved work, lessons, challenges, mysteries; sql.js worker and isolated canonical grading | Reuse for research, trainers and Gyms. No SQL for routine party/inventory actions. |
| Ownership | Unique receipt/instance IDs, independent repeat catches, atomic capture/placement, reward deduplication and recovery outbox | Extend this authority; never introduce a second collection. |
| PC | Expandable 30-slot boxes, nicknames, favorites, box names/wallpapers, destination selection, search, pointer/touch drag, keyboard Move, six profile highlights | These proposed features already existed. This increment adds filters/sorts, cached lookups and a separate active party. Multi-select and release remain missing. |
| Individual records | Species profile, recorded level, shiny flag where known, capture time/location/ball/source/attempts/SQL, nickname and favorite | No form identity, XP, gender, nature, selected ability, IVs, friendship, size variation, original trainer, ribbons or evolution history. Unknown imported fields are preserved. |
| Canonical data | 1,025 species, wide base stats, abilities/types, egg groups, species evolution parents/stages, separate form metadata, base happiness | Evolution parents are not evolution requirements. Growth curves, nature definitions and species gender distributions are not yet bundled in the SQL schema. Moves are absent. |
| Discovery | Historical journal, Seen/Owned status, achievements, Trainer ID | Living/shiny/form objectives need explicit semantics. Do not conflate historical discoveries with current ownership. |
| Exploration | Classic coverage: Kanto 15, Hoenn 14, Johto 17, Sinnoh 16 locations plus nine Safari habitats; Smooth: 23 Kanto/Hoenn outdoors | Smooth has movement/Surf/visible SQL encounters. Native connected water pairs, broader collision rules, persistent spawns and dedicated movement art remain incomplete. |
| Items | Unlimited reusable Repels and optional Shiny Charm; capture themes are cosmetic | No currency, finite evolution inventory, held items, Linking Cords or shop economy. Preserve existing access and odds until deliberately redesigned. |
| Progression | SQL completion and achievements; encounter level follows trainer age | Encounter level is recorded capture history, not earned Pokémon XP. No leveling, evolution, friendship, followers, training companions, quests, Gyms, expeditions or breeding yet. |
| Platform | Local React/Vite/CSS, Canvas, IndexedDB/localStorage, sandboxed Electron and generated offline assets | Keep ordinary single-player play offline. No multiplayer or server dependency is justified. |

Interiors are no longer an absolute architectural restriction under the latest
proposal. They remain unimplemented and are deferred until a concrete service,
Gym or housing increment justifies them. An outdoor leader or challenge panel
can support a Gym first. Unova stays retired; reintroduction needs an evaluated
conversion/art pipeline rather than restoring the removed implementation.

The existing bundled sprite set has 1,025 species images and 295 shiny variants,
not complete form/directional coverage. Keep the current educational shiny policy
(1/128, or 1/64 with the active Charm where art is available). Moving to 1/512 or
1/1,024 would multiply encounter requirements; no balancing change is justified
without playtesting the SQL effort involved. Wrong answers must not reroll traits.

## Scalability findings and architectural decisions

### Ownership, persistence and commands

**Problem:** metadata had no explicit domain schema version. Each PC command reads
all captures, validates the collection and returns a complete snapshot. New XP,
inventory and evolution operations will need larger atomic write sets. Batch
deposit also restarted a slot search for every receipt.

**Decision now:** retain the existing database and transaction owner. Add a
versioned, additive metadata migration and granular party commands. Build a
free-slot sequence once for a deposit batch, preserving destination order and
reward deduplication. Cache UI lookups by instance ID, box/slot and species count.
Only the 30 active slots or the first 60 search matches render; Show more adds
60. These are lookup and bounded-rendering improvements, not full virtualization.

**Alternatives:** a wholesale normalized gameplay-store rewrite or an OPFS/SQL
authority migration would require new recovery, deployment and cross-tab contracts.
Adding more localStorage keys would prevent atomic item/evolution/reward commits.
Neither is justified for this increment.

**Next structural gate:** profile full-snapshot transactions with realistic
collections before replacing them. When activity rewards/evolution arrive, add
IndexedDB stores for individual progression, inventory and durable activity
receipts in one version upgrade. Read/write affected keys inside the transaction;
return revisioned patches and use indexed/paged reads for views. Keep capture IDs,
unique placement and existing outbox recovery. This is a substantive persistence
refactor with moderate implementation/testing cost, justified by those multi-entity
transactions rather than by collection size alone.

**Compatibility/recovery:** current metadata migrations commit with the requested
command, preserve prior metadata and unknown capture fields, and reject future
versions without overwriting them. Existing SQL snapshots, legacy backups and
capture receipts remain independent. IndexedDB is already shared by web/Electron;
no privileged API, runtime fetch or backend is required. Future store upgrades
must handle blocked old tabs and rollback tests before release.

### Rendering, streaming and entity systems

**Problem:** Classic and Smooth implement different terrain/transition policies;
Smooth's lifecycle component coordinates input, assets, camera and entities. A
three-entity idle/wander slice is not evidence that hundreds of NPCs will scale.

**Decision:** retain Canvas and the pure controller for now. Extract an explicit
scene/world coordinator when adding followers/NPC schedules, and keep React out
of frame-by-frame simulation. Use validated map/terrain contracts, a spatial index
and lower-frequency distant behavior when entity counts warrant them. Existing
neighbor streaming, culling and cache leases already bound map work. Shared art
atlases should be measured against current map-scoped palettes before conversion.

**Alternatives:** [Phaser](https://github.com/phaserjs/phaser) supplies broader game
systems; [PixiJS](https://pixijs.com/8.x/guides/components/renderers) offers a rendering
layer. Both add asset/context lifecycle and bundling/migration work. A full ECS
adds registration and debugging complexity; typed entity records plus explicit
systems are adequate for the current count. No dependency was added.

**Benefits/cost/performance gate:** benchmark a representative follower/NPC/water
scene on real iPads and Electron, including frame-time percentiles, memory,
context loss and long-session cleanup. Adopt an engine only if it solves a
measured bottleneck or materially reduces scene maintenance. Never claim a GPU
or FPS improvement from library selection alone. Keep map IDs, tile units,
controller outputs and saves behind an adapter so a renderer replacement does
not migrate ownership. Both alternatives must bundle all assets for offline use.
Unify movement only after terrain/portal/ice/ledge parity fixtures cover existing
Classic locations; retain Classic during that migration.

### State management and domain events

**Problem:** a growing app controller coordinates feature hooks and asynchronous
rewards. Blindly broadcasting events could award XP twice or make order implicit.

**Decision:** keep feature reducers and local frame refs, with app-level
coordination. New durable activity completion should call one typed transaction
service, not fan out independent persistent subscribers. A receipt identifies
the activity/reward, rule version and awarded recipient instance IDs. The
transaction validates prerequisites, claims the reward ID, applies progression,
inventory/quest changes and commits. Only then publish a transient UI notification.
Retries read the receipt and never rerun SQL or recalculate its recipients.

**Alternatives:** [Zustand selectors](https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector)
could reduce UI subscription breadth if profiling demonstrates that need; they
do not replace transactions or recovery. A global event bus makes durable effect
order harder to trace. A full ECS is unrelated to SQL grading and PC authority.

**Benefits/cost/migration:** one owner makes reward order and idempotency testable,
at the cost of explicit command/result types and a new durable receipt store.
Existing capture rewards keep their current IDs/outbox and migrate only when a
tested adapter is ready. No state-library migration is needed now. Offline and
Electron follow the same transaction path. Future release/evolution/expedition
commands must validate references and repair or reject assignments atomically.

### SQL and personal gameplay queries

**Problem:** practice SQLite is deliberately mutable, while game state is not.
Smart boxes cannot safely query or mutate authoritative IndexedDB records directly.

**Decision:** retain sql.js and the existing worker/timeout/cancellation contracts.
Add a separate, read-only, revisioned personal snapshot connection when building
smart boxes. Keep four explicit lanes: mutable practice DB, canonical grading DB,
authoritative game storage and queryable personal snapshot. Materialize instance,
box and party rows from committed state; join canonical species data as needed.
Snapshot refreshes should be coalesced by committed revision, not triggered per
animation frame. Smart results must contain unique, owned `instance_id` values;
invalid/duplicate/unknown IDs produce feedback and never change physical placement.

**Alternatives:** on-demand JSON filtering cannot provide real SQL joins. Generated
SQLite views still need a data source. Native SQLite-WASM/OPFS could change storage
and worker requirements without solving ownership validation. Current sql.js is
adequate until measured query or memory limits demonstrate otherwise.

**Benefits/cost/migration:** reuse CodeMirror, limits, schema introspection and
feedback with a new protocol action and isolated connection. Cost is snapshot
construction, revision handling and persistent smart-query definitions. Old
practice databases remain intact; no SQL may edit ownership, XP, items or rewards.
Limit/truncate results explicitly and design paging for large smart boxes. Test
snapshot staleness, cancellation, schema refresh and offline/Electron parity.
No new SQL technology or queryable gameplay tables ship in this increment.

### Content, scripting and regions

Use [Tiled](https://github.com/mapeditor/tiled) for authoring interchange and extend
the existing source-specific exporters, terrain validator and provenance checks.
Add declarative, typed interaction/quest definitions with a small allowlisted
command vocabulary; do not execute imported native scripts, arbitrary JavaScript
or SQL as authoritative effects. Content validation should check map, species,
item, quest and ability references at build time. This costs an interpreter and
authoring tests, but lets new regions share systems. Renderer/content adapters
preserve saved runtime IDs or provide explicit relocation migrations. Bundle all
definitions and assets for offline/Electron. Multiplayer and a backend are not
part of this design. Optional cross-device saves would need a separate proposal.

## Data models and migration contract

### Implemented collection schema 2

`features/pc/types.ts` extends the existing `Collection` with:

```ts
schemaVersion: 2;
partyIds: string[]; // 0–6 distinct owned instance IDs, ordered; first is leader
migrationBackup?: { schemaVersion: 1; metadata: Record<string, unknown> };
```

The physical IndexedDB database is still `pokesql-collection-v1`, database version
1, with `captures` and `metadata` stores and the unique `[boxId, slot]` index.
The domain version and IndexedDB version are deliberately distinct: adding
metadata needs no object-store upgrade or blocked-tab schema operation.

`migrateCollection` accepts the old unversioned/explicit-v1 shape, preserves all
capture objects and prior metadata, and initializes an empty party. It never
copies the cosmetic showcase into gameplay. It validates the resulting v2 shape
before any write. Reopening v2 is idempotent; malformed records or unknown future
versions leave the original storage untouched. The migration and the requested
command commit/abort together. `migrationBackup` preserves pre-upgrade metadata;
it is not a full export or an automatic user-facing rollback feature. The earlier
`legacyBackup` is retained separately.

Party add/remove/reorder/leader commands read canonical state inside the existing
write transaction. Adding the same instance is idempotent; a seventh member or
an unowned reference is rejected. Removing a member leaves ownership and box
placement intact. Removing the leader promotes the next member. Box movement,
nicknames, favorites, capture history, shiny state and Trainer ID highlights
remain independent. The party currently organizes Pokémon; it does not yet
award XP, unlock abilities, render a follower or provide a combat mechanic.

### Proposed individual progression, not implemented

Keep immutable capture history separate from a current individual profile keyed
by the existing instance ID. A future version should include current species/form,
XP/friendship, nature, gender, ability/hidden-ability slot, six IVs, optional size,
ribbons and evolution history, with explicit profile/rule version and provenance.
Derive stats from canonical base stats, current level, IVs and supported modifiers;
do not copy immutable species definitions into every record. Handle special stat
rules explicitly. Keep captured species/level/location/ball/SQL as historical data
when current species/level changes.

Generate supported traits at a stable encounter lifecycle boundary and persist
the versioned result before retries/reloads can reroll it. Validate form, gender
distribution and ability compatibility against bundled canonical metadata.
Preserve existing shiny/level rolls. Existing records keep unknown historical
traits unknown. If players initialize new gameplay traits for an old Pokémon,
record that assignment separately with its date/rule version; do not label it
as an original capture attribute. Trainer identity and challenge difficulty
cannot be reconstructed reliably from current profile settings.

Existing recorded encounter levels validate in the 5–50 range. A future earned
level must live in progression data rather than rewriting historical capture
levels or relaxing their receipt validator to represent training.

Before implementing XP, import canonical species growth IDs and experience curves,
define recipient/anti-farming policies and add the durable activity ledger.
Before evolution, import condition records rather than deriving eligibility from
`evolves_from_id`. Represent unsupported move/location/form conditions explicitly.
The chosen item/evolution/individual update and reward claim must share one atomic
transaction. Confirmation/cancellation precede item consumption. Evolution retains
the instance ID, nature, IVs, shiny status, nickname, history and ownership.

Trade-trigger records map to a Linking Cord policy. Item trades require the Cord
and the canonical item; counterpart trades also require ownership of the other
species, which is never consumed. Do not implement trading, arbitrary NPC swaps
or hardcode only the example species. Validate branching/forms and revalidate
inventory/ownership inside the final transaction. Failed, repeated or interrupted
commands must not lose items or duplicate individuals.

## Research references

Primary sources inspected on 2026-11-27; this increment imports no community code,
new Pokémon artwork or engine dependency. The following are technical references,
not compatible packages or complete cross-generation gameplay catalogs.

| Source | Finding / decision |
| --- | --- |
| [Emerald instance structures](https://github.com/pret/pokeemerald/blob/master/include/pokemon.h) | Separates species, experience/friendship, IVs and capture attributes. Reuse the conceptual separation, not binary structs or battle assumptions. |
| [Emerald Expansion features](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/FEATURES.md) | Documents expanded Pokémon data and configurable systems. A native ROM-hack base, not a browser dependency; terms for any future copied component require separate review. |
| [Essentials](https://github.com/Maruno17/pokemon-essentials), [license](https://github.com/Maruno17/pokemon-essentials/blob/master/LICENSE) | RPG Maker/Ruby architecture with party/storage/event concepts. Repository license is CC BY-NC-SA 4.0; the full project/graphics are not supplied by cloning it. Reference only. |
| [HeartGold README](https://github.com/pret/pokeheartgold/blob/master/README.md) | Explicit unstable/WIP disassembly and incomplete decompilation warning. Useful future follower reference, not a ready-to-use runtime/exporter. |
| [Platinum](https://github.com/pret/pokeplatinum), [ribbon interface](https://github.com/pret/pokeplatinum/blob/main/include/ribbon.h) | WIP native project with explicit ribbon/individual data systems. Study condition coverage individually; do not infer all evolution mechanics are available in PokéSQL. |
| [Crystal](https://github.com/pret/pokecrystal), [Polished Crystal](https://github.com/Rangi42/polishedcrystal) | Original 2D systems and a modernization project. Good references for explicit QoL policies; generation-specific assembly/content is not our universal data contract. |
| [PokéAPI species CSV](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv), [experience](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/experience.csv), [evolution conditions](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_evolution.csv) | Primary canonical source already used by our ETL. Source contains growth/gender fields and condition records not yet bundled here. Extend build-time data with provenance and tests; no runtime API calls. The requested API documentation URL returned 404 during this inspection, so schema assessment used the CSVs and local builder. |
| [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), [terms](https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md) | Candidate directional-animation discovery source, with CC BY-NC terms and asset/author-specific provenance to review. No claim of complete species/form coverage or matching overworld proportions; no assets imported. |
| [Phaser](https://github.com/phaserjs/phaser), [PixiJS](https://github.com/pixijs/pixijs), [Zustand](https://github.com/pmndrs/zustand), [Tiled](https://github.com/mapeditor/tiled), [sql.js](https://github.com/sql-js/sql.js) | Maintained tool/runtime candidates with different responsibilities. Only existing Tiled interchange and sql.js are used; the architectural decisions above give adoption gates. |

The inspected Phaser, PixiJS and Zustand repository listings identify MIT
licenses. Tiled publishes component-specific licensing in its
[COPYING](https://github.com/mapeditor/tiled/blob/master/COPYING), with GPL,
Apache and BSD license files; using its JSON output does not incorporate its
editor implementation. PokéAPI's repository identifies BSD-3-Clause. No explicit
top-level license was established from the inspected Emerald, Expansion or
Polished Crystal listings; no permission to copy their implementation is inferred.
The pret references are generation-specific reverse-engineering projects, not a
verified complete modern gameplay dataset.

Original game art and individual community contributions require their own
provenance review; a tool's software license does not establish artwork rights.
Future follower support needs a capability manifest per species/form/shiny with
available directions/actions. Use existing static art with an explicit fallback
until a licensed, visually compatible directional set is available. Follow a
validated breadcrumb trail across maps/elevations; hide/recover safely on
unsupported traversal rather than moving through obstacles or blocking the player.

## Ordered implementation plan

1. **This increment:** domain schema migration, safe party references, ordinary
   collection filters/sorts, bounded rendering, lookup indexes and batch allocation.
   These are useful immediately and establish identifiers/recovery for progression.
2. **Individual foundation:** canonical growth/gender/nature/condition dataset,
   versioned trait assignment, individual summary and calculated stats. Preserve
   unknown historical information; do not silently reroll old collections.
3. **Activity rewards and progression:** transactional receipt ledger, frozen
   recipient IDs, XP/friendship policy, party distribution, anti-replay and
   low-grind balancing. SQL errors do not punish friendship. Trainer SQL mastery
   and Pokémon levels remain independent.
4. **Inventory and evolution:** finite item stores, accessible Cord/item sources,
   safe item-use commands, supported evolution conditions/branches and confirmation.
   Add eligibility UI, history, animations and interruption tests. Preserve Repel,
   Charm and free correct-SQL capture; no Poké Ball scarcity barrier.
5. **Followers/companions:** asset capabilities, breadcrumbs and scene coordinator,
   map/Surf/bridge recovery and optional reactions. Existing Surf remains available
   without ownership; mounts can be optional cosmetic/companion choices.
6. **Personal SQL and smart boxes:** isolated snapshot worker connection, schema,
   examples, explicit instance-ID result validation, revisions, previews and saved
   queries. Ordinary visual storage remains usable without SQL.
7. **Quests and mastery:** typed objectives/rewards, optional NPC SQL trainers,
   data-driven Gyms/badges, championships and Legendary research. Reuse canonical
   graders and current scheduled visitors. Gyms can start in town panels or at
   outdoor landmarks; free regional travel does not require advanced SQL mastery.
8. **Exploration content:** native connected water pair, validated bridge/stair/
   object cases, dedicated movement art, persistent spawn policy, fishing and
   cycling. Broaden shared map adapters and only then evaluate complete regions,
   justified interiors and a visually consistent Unova conversion.
9. **Advanced collection:** research expeditions progressing through active play,
   appropriate stat/variety rewards, then breeding/daycare, ribbons, expanded
   cosmetics, housing/ranches and analytics. No multiplayer or long artificial
   waiting requirements. Each depends on stable individual/inventory transactions.

## Verification and performance evidence

Commands run from `web/` with Node 24.22.3. Production build includes TypeScript,
architecture/assets checks, Vite and the generated offline cache. Domain tests
are in `tests/engine/party.spec.ts`; browser tests in `tests/browser/party.spec.ts`
exercise old metadata, rollback, stale tabs, filters, bounded search rendering,
desktop/tablet controls and offline restore. The existing Electron PC smoke now
also checks party persistence independently of profile highlights. Profiles are
disposable and retained under `web/test-results/`.

An isolated comparison used the actual deposit implementation from `23b17ca`
and identical receipts, asserting identical capture placement and box output:

| Batch | Baseline deposit | New deposit | New UI index | New filter |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 74.41 ms | 7.97 ms | 0.70 ms | 0.59 ms |
| 5,000 | 1,258.21 ms | 30.55 ms | 2.05 ms | 1.46 ms |
| 10,000 | 3,649.52 ms | 60.40 ms | 2.83 ms | 1.85 ms |

These are single samples on this machine in Node, excluding IndexedDB, React,
image loading and validation outside the deposit call. They establish the batch
allocation improvement, not total application latency, iPad performance, GPU
throughput or long-session memory guarantees. Source, configuration and timings
are retained under `web/test-results/party-benchmark-source/` and
`web/test-results/party-benchmark-final/`. A 10,000-instance domain check also verifies
unique slots and filter results. Full-snapshot persistence remains O(collection
size); indexed writes/paging are a measured follow-up, not an implemented claim.

Structural self-review uses the local project adapters because the shared toolkit
is unavailable. Review covers migration atomicity, unknown-field retention,
future-version rejection, granular stale-tab commands, ownership/slot invariants,
bounded DOM work and independent SQL/capture/profile behavior.

### Recorded results

- Production build passed: TypeScript, 111-source-file architecture check,
  bundled assets, Vite and 1,551 offline files. The existing large-chunk advisory
  remains; no new runtime dependency was installed.
- The broad engine/browser selection completed with 151 passing scenarios and
  one invalid stress fixture. The fixture exceeded the existing encounter-level
  cap; correcting it to 14–50 and rerunning that case passed. All 152 selected
  scenarios therefore have passing evidence against the final production code.
  Retained traces: `web/test-results/gameplay-foundation-final/` and
  `web/test-results/gameplay-foundation-large-recheck/`.
- Coverage includes old metadata/unknown fields, rollback and retry, stale tabs,
  six-instance party limits, ordinary filters, 3,000-record bounded browser
  results, 10,000-record domain allocation, pointer/touch PC movement, both iPad
  orientations, offline restore, capture/shiny/outbox deduplication, profile
  highlights, SQL transactions/cancellation, mysteries, achievements, Unova
  retirement and Smooth land/Surf/capture behavior.
- Two Electron smoke scenarios passed with isolated hidden profiles: existing
  Smooth Surf restoration and PC capture/party/showcase persistence after native
  restart. Evidence is in `web/test-results/gameplay-foundation-desktop-final/`
  and `web/test-results/gameplay-foundation-desktop-recheck/`. The latter reruns
  the PC test after opening the new collapsed party panel before counting visible
  members. This is the production frontend in Electron, not a newly packaged
  installer or physical-iPad certification.
- The baseline allocation comparison passed with identical placements at all
  three sizes. The final desktop party screenshot and portrait-tablet layout
  were visually inspected. Changed documentation links and diff whitespace pass.

The focused browser regression also exposed an off-viewport drag-test target after
the PC layout grew. The party is now collapsed by default, and the test scrolls
the destination into view before continuing the existing pointer gesture. Native
mouse and touch move/swap tests pass. A label-selector mismatch in the new filter
test was corrected to use the select's accessible combobox role. Initial failure
traces remain retained rather than being deleted.
