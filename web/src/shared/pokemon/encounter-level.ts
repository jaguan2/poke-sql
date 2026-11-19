const MIN_LEVEL = 5;
const LEVEL_COUNT = 46;

// A random encounter key rolls a cosmetic level. Passing an existing key also
// gives older saves a stable level without changing their progress.
export function encounterLevel(seed: string = crypto.randomUUID()): number {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return MIN_LEVEL + (hash >>> 0) % LEVEL_COUNT;
}

export const isEncounterLevel = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= MIN_LEVEL && value < MIN_LEVEL + LEVEL_COUNT;
