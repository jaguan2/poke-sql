import type { Collection, CollectionCommand } from "./types";

type PartyCommand = Extract<CollectionCommand, { type: "party-add" | "party-remove" | "party-leader" | "party-reorder" }>;
export function applyPartyCommand(collection: Collection, command: PartyCommand): Collection {
  if (!collection.captures.some(capture => capture.id === command.id)) throw new Error("Choose a Pokémon that you own.");
  const ids = [...collection.partyIds], index = ids.indexOf(command.id);
  if (command.type === "party-add") {
    if (index !== -1) return collection;
    if (ids.length >= 6) throw new Error("Your active party can contain up to six Pokémon.");
    ids.push(command.id);
  } else if (command.type === "party-remove") {
    if (index === -1) return collection;
    ids.splice(index, 1);
  } else {
    if (index === -1) throw new Error("This Pokémon is not in your active party.");
    if (command.type === "party-leader") { ids.splice(index, 1); ids.unshift(command.id); }
    else {
      const next = index + (command.direction === "earlier" ? -1 : 1);
      if (next < 0 || next >= ids.length) return collection;
      [ids[index], ids[next]] = [ids[next], ids[index]];
    }
  }
  return { ...collection, partyIds: ids };
}
