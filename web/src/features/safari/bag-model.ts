import items from "./bag-items.json" with { type: "json" };

export type BagItemId = "repel" | "super-repel" | "max-repel" | "shiny-charm";
type RepelId = Exclude<BagItemId, "shiny-charm">;
export interface BagState {
  used: Record<RepelId, number>;
  repelSteps: number;
  charmEnabled: boolean;
}
export const SHINY_ODDS = 128;
export const CHARM_UNLOCK_CATCHES = 10;
export const BAG_ITEMS = items as readonly (Omit<typeof items[number], "id"> & { id: BagItemId })[];
export function createBag(): BagState {
  return { used: { repel: 0, "super-repel": 0, "max-repel": 0 }, repelSteps: 0, charmEnabled: false };
}
export function isBagState(value: unknown): value is BagState {
  if (!value || typeof value !== "object") return false;
  const bag = value as Partial<BagState>;
  return !!bag.used && ["repel", "super-repel", "max-repel"].every(id => {
    const used = bag.used![id as RepelId];
    return Number.isSafeInteger(used) && used >= 0;
  }) && Number.isInteger(bag.repelSteps) && Number(bag.repelSteps) >= 0 && Number(bag.repelSteps) <= 250
    && typeof bag.charmEnabled === "boolean";
}
export function itemQuantity(bag: BagState, catches: number, id: BagItemId): number {
  if (id === "shiny-charm") return catches >= CHARM_UNLOCK_CATCHES ? 1 : 0;
  const item = BAG_ITEMS.find(item => item.id === id)!;
  return Math.max(0, item.starter + (item.rewardEvery ? Math.floor(catches / item.rewardEvery) : 0) - bag.used[id]);
}
export function shinyOdds(bag: BagState, catches: number): number {
  return bag.charmEnabled && catches >= CHARM_UNLOCK_CATCHES ? SHINY_ODDS / 2 : SHINY_ODDS;
}
/** Both item use and the step counter commit with the expedition in one save. */
export function useBagItem(bag: BagState, catches: number, id: BagItemId): BagState {
  if (!itemQuantity(bag, catches, id)) return bag;
  if (id === "shiny-charm") return { ...bag, charmEnabled: !bag.charmEnabled };
  if (bag.repelSteps) return bag;
  return { ...bag, used: { ...bag.used, [id]: bag.used[id] + 1 }, repelSteps: BAG_ITEMS.find(item => item.id === id)!.steps };
}

