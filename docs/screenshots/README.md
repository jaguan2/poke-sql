# PokéSQL screenshot gallery

Fresh application photos captured November 19, 2026, from the production build
in isolated Chrome contexts. These replace the older galleries and videos.
The primary gallery targets desktop browsers and iPads. Tablet images use touch
emulation at portrait/landscape sizes; they are not captures from physical iPad hardware.

The demonstration profile has 12 Pokédex entries, 12 Safari catches and four
completed challenges. The Lapras catch runs a correct SQL statement and raises
the catch counter to 13. These are demo saves, not a live user's progress.
The daily mystery uses January 1, 2026, so the gallery does not reveal today's puzzle.

| View | Theme | Viewport |
| --- | --- | --- |
| [Get started](get-started.png) | Poké Ball | 1600 × 1100 |
| [Challenges](challenges.png) | Great Ball | 1600 × 1100 |
| [SQL workspace](sql-workspace.png) | Master Ball | 1600 × 1100 |
| [Daily mystery and clues](daily-mystery.png) | Dive Ball | 1600 × 1550 |
| [Verdant Forest route](safari-route.png) | Dusk Ball | 1600 × 1800 |
| [Safari SQL encounter](safari-encounter.png) | Ultra Ball | 1600 × 1100 |
| [Lapras catch and Pokédex entry](safari-catch.png) | Heal Ball | 1600 × 1100 |
| [Personal Pokédex](pokedex.png) | Heal Ball | 1600 × 1100 |
| [Achievements](achievements.png) | Luxury Ball | 1600 × 1100 |
| [Trainer ID and models](trainer-id.png) | Great Ball | 1600 × 1300 |
| [Settings](settings.png) | Master Ball | 1600 × 1100 |
| [Schema and guide](schema-guide.png) | Poké Ball | 1600 × 1100 |
| [Portrait tablet SQL workspace](tablet-workspace.png) | Poké Ball | 820 × 1180, touch |
| [Landscape tablet Safari](tablet-safari.png) | Dive Ball | 1180 × 820, touch |

## SQL workspace

![A query returns a team of Pokémon with bundled sprites and stats](sql-workspace.png)

## Full-width Safari catch

![Lapras caught through SQL with its Pokédex entry beside the battle](safari-catch.png)

## Trainer ID

![Trainer ID with collection progress, SQL badges and eight model choices](trainer-id.png)

## Refresh these photos

From `web/`, run `npm.cmd run screenshots`. It builds production assets and uses
the separate Playwright screenshot project on its own strict port, 4176. The
normal test suite excludes this project. Captures wait for fonts, sprites and
offline assets, reset page scrolling, and save these same 14 filenames.

Set `POKESQL_SCREENSHOT_DIR` to stage captures elsewhere before replacing the
gallery. Test results and failure traces stay in `web/test-results/`.
