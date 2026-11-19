# PC boxes: research and proposed design

Research date: November 19, 2026. PC Boxes and six profile highlights are now
implemented. The sections below retain the original research/design proposal.
The shipped version starts with 64 boxes, expands automatically, stores captures
with a unique box/slot index, and bridges game saves through a per-reward outbox.
Its capture ID also serves as the normal reward receipt; legacy consumed IDs and
original save bytes live in the migration metadata. See [README](../README.md)
and [architecture](ARCHITECTURE.md) for the current behavior and ownership.

## Recommendation

Add **PC Boxes** under Discover, beside My Pokédex. Every newly confirmed Safari
catch or solved mystery round deposits an individual Pokémon into a box.
The Pokédex continues to track unique species: catching three Pikachu means
three PC occupants and one Pokédex entry.

Use the familiar 30-slot box, with six columns and five rows. Give boxes names
and backgrounds, and show a selected Pokémon's summary beside the grid on a
desktop or landscape tablet. On a portrait iPad, put the summary below it.

## What the games provide as a reference

| Mechanic | Evidence | Application to PokéSQL |
| --- | --- | --- |
| 30 Pokémon per box | Nintendo's historical Pokémon Bank manual, section 5 | Keep this recognizable unit. |
| Six columns, five rows; named boxes and wallpapers | FireRed/Emerald storage structures in the pret reconstructions | Match our existing game-inspired presentation. |
| Placement scans for an empty slot, then continues through other boxes | Emerald's reconstructed `CopyMonToPC` routine | Automatically place catches, starting with the destination box. |
| Selection, swapping and touch controls | Pokémon Bank manual, section 8 | Support tap/select/move and keyboard navigation; dragging can be optional. |

Sources: [Nintendo Pokémon Bank manual](https://csassets.nintendo.com/noaext/image/private/t_KA_PDF/manual-3DS-pokemon-bank-en?_a=DATAg1AAZAA0),
[FireRed storage definitions](https://github.com/pret/pokefirered/blob/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/include/pokemon_storage_system.h),
[Emerald storage definitions](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/include/pokemon_storage_system.h),
[Emerald placement routine](https://github.com/pret/pokeemerald/blob/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/src/pokemon.c#L4291-L4321).
The pret projects are community reconstructions, not Nintendo-published source.
Their revisions above match the game's source references already used here.

The classic implementations have finite capacity. For PokéSQL, automatically
creating another box when every existing box is full is a proposed adaptation:
solving an exercise should not lose its reward because a box filled up.

## What our code already stores

- [Pokédex encounters](../web/src/features/pokedex/encounters.ts) merge
  discoveries by species ID. They retain first discovery, best attempt count
  and sources, but cannot represent several individuals of one species.
- [Safari](../web/src/features/safari/model.ts) verifies an active encounter's
  result before incrementing the catch count. The session retains only its
  latest catch, not a complete capture history.
- [SafariCatch](../web/src/features/safari/types.ts) has an encounter ID,
  species profile, attempts and timestamp. Its level lives on the encounter;
  capture ball and biome are not part of the saved catch record.
- [Mystery rounds](../web/src/features/mystery/model.ts) need a persistent random
  round ID. [Daily rounds](../web/src/features/mystery/daily.ts) already have a
  UTC date and schedule version suitable for identifying one daily reward.
- The editable SQL database has its own
  [IndexedDB snapshot store](../web/src/shared/storage/snapshots.ts). Actual
  collection ownership should remain separate from this practice database.

Consequently, rendering the current Pokédex array as a box would lose the main
PC behavior: keeping each individual catch.

## First version

1. **Automatic deposit.** After a confirmed win, find the destination box's
   first empty slot, continue through the other boxes, then create a box if
   necessary. Show “Pikachu was sent to Forest — slot 12” with an Open PC action.
2. **Individual summaries.** Show species, nickname, encounter level, types,
   capture date, source/biome and attempts. Preserve the ball shown at capture
   time so changing the application's theme does not rewrite capture history.
3. **Organization.** Switch and rename boxes, choose a destination box, move or
   swap occupants, nickname Pokémon, favorite them, and search across boxes.
   Keep physical slots stable while filtering; search results should link to
   the actual box and slot.
4. **Desktop and iPad controls.** Use at least 44px touch targets. Tap an occupant,
   choose Move, then tap a destination; an occupied destination swaps occupants.
   Arrow keys move focus, Enter selects and Escape cancels. Explain an empty
   collection with a Safari action.
5. **Existing visual resources.** Reuse the bundled species PNGs, ball sprites,
   type badges and palette variables. Box frames/backgrounds can start as CSS.
   Any additional game artwork must follow the existing vendoring and credits
   pipeline, with no runtime image downloads.

Defer party management, trading, releasing, breeding, IVs and EVs. There is no
battle/team system to give those mechanics a purpose yet. Current encounter
levels are cosmetic; the PC should not imply that battle progression exists.

## Saving captures without duplication

Use a separate, versioned IndexedDB collection database. IndexedDB supports
transactions spanning object stores; use one transaction for an individual,
its slot assignment and the processed reward ID. A unique reward ID prevents
two tabs or a reload from depositing the same win twice. This uses the
[IndexedDB transaction model](https://www.w3.org/TR/IndexedDB-2/#transaction-concept).

Minimum records:

| Record | Important fields |
| --- | --- |
| Captured individual | Unique instance ID, species/profile, level, capture ball, timestamp, source, optional biome, attempts, nickname, favorite |
| Box | Stable ID, name, wallpaper, display order |
| Placement | Instance ID, box ID, slot 0–29; unique box/slot and unique instance |
| Processed reward | Stable source event ID mapped to the awarded individual |

Safari can use `safari:<encounterId>`. Daily rewards can use schedule version
and UTC date; random mysteries need a saved round ID created when the round
starts. A species ID alone is never a reward ID.

Route confirmed rewards through an app-owned coordinator; PC behavior belongs
in `src/features/pc/`, with feature-independent persistence helpers in shared
only where actually reusable. Never award from arbitrary SQL result rows,
animation completion, or a component mounting.

Commit the capture before reporting it as saved. Then reconcile the Safari
session and species journal from the committed reward. Those existing saves
use localStorage, so they cannot participate in the IndexedDB transaction:
reconciliation must tolerate an interrupted update and rerun safely on reload.
A failed save needs a retryable verified reward, rather than another SQL attempt
or a successful-looking box deposit. Concurrent deposits and moves must resolve
inside transactions, not from a stale copy of the visible grid.

Resetting or modifying the SQL practice database must never change PC ownership.
The feature remains local to the browser/Electron profile; it does not add
cross-device sync. Collection backup/export would be a useful companion feature.

## Existing-player migration

Historical duplicate catches cannot be reconstructed: the journal has one row
per species, and the Safari total does not identify the missing individuals.

Import **one legacy occupant per recorded species**, clearly marked as imported.
Preserve known discovery information; leave unavailable capture level, ball,
biome and exact catch time unknown. Do not fabricate individual catches from
the Safari counter. Keep existing journal completion and historical counters.
Explain that PC individual counts start from the available imported records.

Back up the original progress bytes before migration and use a migration marker
in the collection transaction. Seed processed reward IDs for the saved solved
rounds/latest Safari catch represented by the import, so reopening them does not
award another occupant. Preserve the current
[journal recovery contract](../web/src/features/pokedex/persistence.ts): if a
backup cannot be saved, do not overwrite the original progress.

## Verification before shipping

- Two distinct catches of the same species produce two individuals and one
  Pokédex species entry; replaying one reward produces no additional occupant.
- Failed/wrong/cancelled SQL and stale worker replies produce no deposit.
- Reloading during the throw animation retains exactly one saved catch.
- The 31st capture goes into another box; concurrent tabs cannot claim one slot.
- Moving/swapping across boxes and reloading preserves both occupants.
- Migration runs once, preserves original progress and tolerates missing legacy
  fields, corrupted saves, blocked upgrades and failed storage writes.
- Practice `DROP`/`DELETE` and Reset DB leave the collection intact.
- Verify keyboard and touch interactions on desktop and both iPad orientations,
  including offline loading and the existing isolated desktop smoke test.

Later, SQL exercises could query a read-only copy of the trainer's collection
for questions such as “Which type have I caught most?” Keep that copy separate
from the real collection so practice statements remain harmless.
