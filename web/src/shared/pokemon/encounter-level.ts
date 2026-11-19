const MIN_LEVEL = 5;
const MAX_LEVEL = 50;
const LEVEL_SPREAD = 5;

function levelOffset(seed: string, count: number): number {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % count;
}

// Roll inside a six-level window. Once its ceiling reaches 50, keep the
// window wide enough for later encounters to retain the random variation.
export function encounterLevel(seed: string, trainerDays = 0): number {
  const floor = Math.min(MIN_LEVEL + trainerDays, MAX_LEVEL - LEVEL_SPREAD);
  return floor + levelOffset(seed, LEVEL_SPREAD + 1);
}

// Saves from before levels were persisted used this roll on every render.
export const legacyEncounterLevel = (seed: string): number => MIN_LEVEL + levelOffset(seed, MAX_LEVEL - MIN_LEVEL + 1);

export const isEncounterLevel = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= MIN_LEVEL && value <= MAX_LEVEL;
