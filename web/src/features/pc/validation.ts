import { isPokemonProfile } from "../../shared/pokemon/profile";
import { isEncounterLevel } from "../../shared/pokemon/encounter-level";
import balls from "../../shared/pokemon/ball-themes.json" with { type: "json" };
import type { CaptureReceipt, Collection, DiscoverySource, Wallpaper } from "./types";

export const WALLPAPERS: { id: Wallpaper; name: string }[] = [
  { id: "forest", name: "Forest" }, { id: "coast", name: "Coast" },
  { id: "cave", name: "Cave" }, { id: "city", name: "City" },
];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export const isDiscoverySource = (v: unknown): v is DiscoverySource => v === "safari" || v === "daily" || v === "random";

export function isCaptureReceipt(v: unknown): v is CaptureReceipt {
  return record(v) && text(v.id, 160) && v.id.length > 0 && isPokemonProfile(v.pokemon)
    && v.pokemon.id <= 1025 && v.pokemon.generationId <= 9
    && (v.source === "legacy" || isDiscoverySource(v.source))
    && Array.isArray(v.sources) && v.sources.length > 0 && v.sources.length <= 3
    && v.sources.every(isDiscoverySource) && new Set(v.sources).size === v.sources.length
    && (v.source === "legacy" || (v.sources.length === 1 && v.sources[0] === v.source))
    && (v.level === null || isEncounterLevel(v.level))
    && (v.ball === null || balls.some(ball => ball.id === v.ball))
    && date(v.firstRecordedAt) && (v.caughtAt === null || date(v.caughtAt))
    && (v.source === "legacy" || (v.caughtAt !== null && v.ball !== null && v.level !== null))
    && (v.location === null || text(v.location, 100)) && positive(v.attempts)
    && (v.sql === null || text(v.sql, 100_000));
}

export function isCollection(v: unknown): v is Collection {
  if (!record(v) || !Array.isArray(v.captures) || !Array.isArray(v.boxes) || !v.boxes.length
    || typeof v.migrated !== "boolean" || !Array.isArray(v.legacyRewardIds)
    || !v.legacyRewardIds.every(id => text(id, 160))
    || (v.legacyBackup !== null && (!record(v.legacyBackup) || !Object.values(v.legacyBackup).every(value => value === null || typeof value === "string")))) return false;
  const boxIds = new Set<number>();
  for (const [index, box] of v.boxes.entries()) {
    if (!record(box) || box.id !== index + 1 || !positive(box.id) || !text(box.name, 32) || !box.name.trim()
      || !WALLPAPERS.some(wallpaper => wallpaper.id === box.wallpaper)) return false;
    boxIds.add(box.id);
  }
  const ids = new Set<string>();
  const positions = new Set<string>();
  for (const capture of v.captures) {
    if (!record(capture) || !isCaptureReceipt(capture) || !positive(capture.boxId) || !boxIds.has(capture.boxId)
      || !Number.isInteger(capture.slot) || Number(capture.slot) < 0 || Number(capture.slot) >= 30
      || !text(capture.nickname, 24) || typeof capture.favorite !== "boolean" || ids.has(capture.id)) return false;
    const position = `${capture.boxId}:${capture.slot}`;
    if (positions.has(position)) return false;
    ids.add(capture.id); positions.add(position);
  }
  return positive(v.destinationBoxId) && boxIds.has(v.destinationBoxId) && Array.isArray(v.featuredIds) && v.featuredIds.length <= 6
    && v.featuredIds.every(id => typeof id === "string" && ids.has(id)) && new Set(v.featuredIds).size === v.featuredIds.length;
}
