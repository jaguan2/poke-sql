import type { CapturedPokemon, Collection } from "./types";

export function indexCollection(collection: Collection | null) {
  const byId = new Map<string, CapturedPokemon>(), byBox = new Map<number, Map<number, CapturedPokemon>>(), speciesCounts = new Map<number, number>();
  for (const capture of collection?.captures ?? []) {
    byId.set(capture.id, capture);
    let slots = byBox.get(capture.boxId);
    if (!slots) { slots = new Map(); byBox.set(capture.boxId, slots); }
    slots.set(capture.slot, capture);
    speciesCounts.set(capture.pokemon.id, (speciesCounts.get(capture.pokemon.id) ?? 0) + 1);
  }
  return { byId, byBox, speciesCounts, boxesById: new Map(collection?.boxes.map(box => [box.id, box])) };
}
export type CollectionFilter = "all" | "favorites" | "shiny" | "duplicates" | "party";
export type CollectionSort = "box" | "name" | "level" | "newest";
export function filterCollection(collection: Collection | null, index: ReturnType<typeof indexCollection>, search: string, filter: CollectionFilter, sort: CollectionSort) {
  const query = search.trim().toLocaleLowerCase(), party = new Set(collection?.partyIds);
  const matches = (collection?.captures ?? []).filter(capture => {
    if (query && !`${capture.nickname} ${capture.pokemon.name}`.toLocaleLowerCase().includes(query)) return false;
    return filter === "all" || filter === "favorites" && capture.favorite || filter === "shiny" && capture.shiny === true
      || filter === "duplicates" && (index.speciesCounts.get(capture.pokemon.id) ?? 0) > 1 || filter === "party" && party.has(capture.id);
  });
  return matches.sort((a, b) => {
    const order = sort === "name" ? (a.nickname || a.pokemon.name).localeCompare(b.nickname || b.pokemon.name)
      : sort === "level" ? (b.level ?? -1) - (a.level ?? -1)
      : sort === "newest" ? (b.caughtAt ?? b.firstRecordedAt).localeCompare(a.caughtAt ?? a.firstRecordedAt)
      : a.boxId - b.boxId || a.slot - b.slot;
    return order || a.id.localeCompare(b.id);
  });
}
