import { encounterTable } from "./zones";
import type { Position, SafariZoneDefinition, WeatherId, ZoneId } from "./zones";

export const RANGER_POSITIONS: Readonly<Record<ZoneId, Position>> = {
  forest: { x: 8, y: 16 },
  wetlands: { x: 36, y: 22 },
  ridge: { x: 20, y: 30 },
  meadow: { x: 57, y: 8 },
  coast: { x: 15, y: 10 },
  desert: { x: 33, y: 37 },
  cave: { x: 5, y: 8 },
  tundra: { x: 8, y: 25 },
  volcano: { x: 14, y: 38 },
};

const SIGHTINGS = new Map<number, string>([
  [123, "Someone found a row of stalks cut clean through. The grass was still moving when they looked up."],
  [25, "I heard a sharp crackle in the ferns. For a second, two round spots lit up in the shade."],
  [283, "Something tiny skated across a pool on long legs. It barely broke the surface."],
  [246, "A low ridge of broken stones led off the trail. Whatever made it had been chewing the rocks."],
  [133, "A little brown shape with a pale ruff slipped through the flowers. Its tail was the last thing I saw."],
  [131, "A long neck rose beyond the surf, followed by a broad shell. I heard a low call as it drifted out of sight."],
  [443, "A small fin poked out of the sand by a burrow. Then the sand moved and the fin was gone."],
  [633, "Something with a dark fringe over its eyes bumped into a boulder. It gave the rock a bite before moving on."],
  [996, "I found tiny footprints beside a scraping in the ice. A dark fin vanished between the snowbanks."],
  [324, "A cloud of dark smoke rose from something low to the ground. A moment later I saw a warm glow through it."],
  [640, "A green figure crossed the path in two quiet strides. Its horns caught the light like the edges of blades."],
  [245, "I saw a long ribbon trail behind a shape running across the water. The pool went still as it passed."],
  [639, "A heavy shape with two blunt horns crossed the ridge. I felt each step through the soles of my boots."],
  [488, "A sliver of pale light floated over the flowers. It curved like a crescent as it turned."],
  [249, "A pair of pale wings broke the surface offshore. A gust reached the beach before the waves did."],
  [718, "Something long crossed the dunes after dark. Little green lights along its body blinked out one by one."],
  [487, "A huge shadow crossed the cavern wall. I counted several black points sweeping behind it."],
  [144, "Snow started falling where a broad-winged bird flew past. Its long tail trailed through the flurries."],
  [244, "The air grew hot before I heard the heavy footfalls. A gray shape billowed above the creature's back."],
  [251, "A tiny green figure floated between the trees. For a moment I could have sworn I heard the same twig snap twice."],
  [492, "A clump of grass with a pink flower toddled across the meadow. A sweet smell lingered after it disappeared."],
  [490, "A small blue swimmer surfaced where the waves broke. Two long feelers stood out against the foam."],
  [151, "Something pink curled up in midair deep in the cave. Its long, thin tail uncoiled as it floated away."],
  [385, "A small star-shaped figure hung above the stones. Thin blue tags fluttered from its points."],
  [494, "A small figure darted past the springs. Its tall ears formed a V in the heat haze."],
]);

export function rangerSighting(zone: SafariZoneDefinition, weather: WeatherId, previousId: number | undefined, date: string): string {
  const { rows } = encounterTable(zone, weather, previousId, date);
  const visitors = rows.filter(({ pokemon }) => pokemon.rarity === "Legendary" || pokemon.rarity === "Mythical");
  const candidates = visitors.length ? visitors : rows.filter(({ pokemon }) => pokemon.rarity === "Rare");
  const quiet = "No rare Pokémon are on the move right now. Check with me again after your next catch.";
  if (!candidates.length) return quiet;
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const index = ((day % candidates.length) + candidates.length) % candidates.length;
  return SIGHTINGS.get(candidates[index].pokemon.id) ?? quiet;
}
