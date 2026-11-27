import type { PokemonProfile } from "../../shared/pokemon/profile";

export type DiscoverySource = "safari" | "daily" | "random";
export type Wallpaper = "forest" | "coast" | "cave" | "city";
export interface PCBox { id: number; name: string; wallpaper: Wallpaper }
export interface CaptureReceipt {
  id: string;
  pokemon: PokemonProfile;
  source: DiscoverySource | "legacy";
  sources: DiscoverySource[];
  level: number | null;
  shiny?: boolean;
  ball: string | null;
  caughtAt: string | null;
  firstRecordedAt: string;
  location: string | null;
  attempts: number;
  sql: string | null;
}
export interface CapturedPokemon extends CaptureReceipt {
  boxId: number; slot: number; nickname: string; favorite: boolean;
}
export interface Collection {
  schemaVersion: 2;
  captures: CapturedPokemon[];
  boxes: PCBox[];
  destinationBoxId: number;
  featuredIds: string[];
  partyIds: string[]; // Ordered instance IDs; first is the leader, separate from the profile.
  migrationBackup?: { schemaVersion: 1; metadata: Record<string, unknown> };
  migrated: boolean;
  legacyRewardIds: string[];
  legacyBackup: Record<string, string | null> | null;
}
export interface LegacyImport {
  discoveries: CaptureReceipt[];
  consumedIds: string[];
  backup: Record<string, string | null> | null;
}
export type CollectionCommand =
  | { type: "party-add"; id: string }
  | { type: "party-remove"; id: string }
  | { type: "party-leader"; id: string }
  | { type: "party-reorder"; id: string; direction: "earlier" | "later" }
  | { type: "deposit"; receipts: CaptureReceipt[] }
  | { type: "add-box" }
  | { type: "rename-box"; boxId: number; name: string }
  | { type: "wallpaper"; boxId: number; wallpaper: Wallpaper }
  | { type: "destination"; boxId: number }
  | { type: "move"; id: string; boxId: number; slot: number }
  | { type: "nickname"; id: string; name: string }
  | { type: "favorite"; id: string; favorite: boolean }
  | { type: "featured"; ids: string[] };
