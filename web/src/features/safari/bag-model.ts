import items from "./bag-items.json" with { type: "json" };

export type BagItemId = "repel" | "super-repel" | "max-repel" | "shiny-charm";
export interface BagState {
  repelSteps: number;
  charmEnabled: boolean;
}
export const SHINY_ODDS = 128;
export const CHARM_UNLOCK_CATCHES = 10;
export const BAG_ITEMS = items as readonly (Omit<typeof items[number], "id"> & { id: BagItemId })[];
export function createBag(): BagState {
  return { repelSteps: 0, charmEnabled: false };
}
export function isBagState(value: unknown): value is BagState {
  if (!value || typeof value !== "object") return false;
  const bag = value as Partial<BagState>;
  return Number.isInteger(bag.repelSteps) && Number(bag.repelSteps) >= 0 && Number(bag.repelSteps) <= 250
    && typeof bag.charmEnabled === "boolean";
}
/** Unlimited quantities are derived UI values, never serialized into the save. */
export function itemQuantity(catches: number, id: BagItemId): number {
  return id === "shiny-charm" ? catches >= CHARM_UNLOCK_CATCHES ? 1 : 0 : Infinity;
}
export function shinyOdds(bag: BagState, catches: number): number {
  return bag.charmEnabled && catches >= CHARM_UNLOCK_CATCHES ? SHINY_ODDS / 2 : SHINY_ODDS;
}
/** Both item use and the step counter commit with the expedition in one save. */
export function useBagItem(bag: BagState, catches: number, id: BagItemId): BagState {
  if (!itemQuantity(catches, id)) return bag;
  if (id === "shiny-charm") return { ...bag, charmEnabled: !bag.charmEnabled };
  if (bag.repelSteps) return bag;
  return { ...bag, repelSteps: BAG_ITEMS.find(item => item.id === id)!.steps };
}

