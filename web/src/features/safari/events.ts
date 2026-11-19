import type { SafariSpecies, ZoneId } from "./zones";

interface EventVisitor extends SafariSpecies {
  zoneId: ZoneId;
  rarity: "Legendary" | "Mythical";
}

// Visitors stay in the species registry for restored encounters and catches.
// Their zero ordinary weight reserves new rolls for active event windows.
const legendary = (zoneId: ZoneId, id: number, name: string): EventVisitor =>
  ({ zoneId, id, name, rarity: "Legendary", weight: 0, favoredWeather: [] });
const mythical = (zoneId: ZoneId, id: number, name: string): EventVisitor =>
  ({ zoneId, id, name, rarity: "Mythical", weight: 0, favoredWeather: [] });

const LEGENDARY_VISITORS = [
  legendary("forest", 640, "Virizion"), legendary("wetlands", 245, "Suicune"),
  legendary("ridge", 639, "Terrakion"), legendary("meadow", 488, "Cresselia"),
  legendary("coast", 249, "Lugia"), legendary("desert", 718, "Zygarde"),
  legendary("cave", 487, "Giratina"), legendary("tundra", 144, "Articuno"),
  legendary("volcano", 244, "Entei"),
];
const MYTHICAL_VISITORS = [
  mythical("forest", 251, "Celebi"), mythical("meadow", 492, "Shaymin"),
  mythical("coast", 490, "Manaphy"), mythical("cave", 151, "Mew"),
  mythical("ridge", 385, "Jirachi"), mythical("volcano", 494, "Victini"),
];
export const SAFARI_EVENT_VISITORS: readonly EventVisitor[] = [...LEGENDARY_VISITORS, ...MYTHICAL_VISITORS];

export interface SafariEvent {
  visitor: EventVisitor;
  startsOn: string;
  endsOn: string;
  active: boolean;
  chance: number;
}

const DAY_MS = 86_400_000;
const EPOCH_FRIDAY = Date.UTC(2026, 0, 2);
const dateKey = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const wrap = (index: number, length: number) => ((index % length) + length) % length;

// All windows use UTC and an exclusive end date. Upcoming visits are shown
// between events. Stored encounters are independent of these roll windows.
export function safariEvents(date: string): readonly SafariEvent[] {
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day) || dateKey(day) !== date) {
    throw new Error("Use a valid UTC date for Safari events.");
  }
  const calendar = new Date(day);
  const sinceFriday = (calendar.getUTCDay() + 2) % 7;
  const friday = day + (sinceFriday < 3 ? -sinceFriday : 7 - sinceFriday) * DAY_MS;
  const week = Math.floor((friday - EPOCH_FRIDAY) / (7 * DAY_MS));
  const monthOffset = calendar.getUTCDate() <= 7 ? 0 : 1;
  const month = calendar.getUTCMonth() + monthOffset;
  const monthStart = Date.UTC(calendar.getUTCFullYear(), month, 1);
  const monthIndex = (calendar.getUTCFullYear() - 2026) * 12 + month;
  const windows = [
    { visitor: LEGENDARY_VISITORS[wrap(week, LEGENDARY_VISITORS.length)], start: friday, end: friday + 3 * DAY_MS, chance: 0.01 },
    { visitor: MYTHICAL_VISITORS[wrap(monthIndex, MYTHICAL_VISITORS.length)], start: monthStart, end: monthStart + 7 * DAY_MS, chance: 0.0025 },
  ];
  return windows.map(({ visitor, start, end, chance }) => ({
    visitor, startsOn: dateKey(start), endsOn: dateKey(end), active: day >= start && day < end, chance,
  }));
}
