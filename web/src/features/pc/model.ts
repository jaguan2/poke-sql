import type { CaptureReceipt, Collection, CollectionCommand, LegacyImport, PCBox } from "./types";
import { isCaptureReceipt, WALLPAPERS } from "./validation";
import { applyPartyCommand } from "./party-model";

const makeBox = (id: number): PCBox => ({ id, name: `Box ${id}`, wallpaper: WALLPAPERS[(id - 1) % WALLPAPERS.length].id });
export function createCollection(): Collection {
  return { schemaVersion: 2, captures: [], boxes: Array.from({ length: 64 }, (_, i) => makeBox(i + 1)), destinationBoxId: 1,
    featuredIds: [], partyIds: [], migrated: false, legacyRewardIds: [], legacyBackup: null };
}

export function deposit(collection: Collection, receipts: CaptureReceipt[]): Collection {
  if (!receipts.length) return collection;
  const captures = [...collection.captures];
  const boxes = [...collection.boxes];
  const ids = new Set([...captures.map(capture => capture.id), ...collection.legacyRewardIds]);
  const occupied = new Set(captures.map(capture => `${capture.boxId}:${capture.slot}`));
  const start = boxes.findIndex(box => box.id === collection.destinationBoxId);
  if (start < 0) throw new Error("This catch destination is unavailable.");
  const free: { boxId: number; slot: number }[] = [];
  for (let offset = 0; offset < boxes.length; offset++) {
    const box = boxes[(start + offset) % boxes.length];
    for (let slot = 0; slot < 30; slot++) if (!occupied.has(`${box.id}:${slot}`)) free.push({ boxId: box.id, slot });
  }
  let cursor = 0;
  for (const receipt of receipts) {
    if (!isCaptureReceipt(receipt)) throw new Error("This capture could not be verified.");
    if (ids.has(receipt.id)) continue;
    if (cursor === free.length) {
      const box = makeBox(boxes.length + 1); boxes.push(box);
      for (let slot = 0; slot < 30; slot++) free.push({ boxId: box.id, slot });
    }
    const placement = free[cursor++];
    captures.push({ ...receipt, ...placement, nickname: "", favorite: false });
    ids.add(receipt.id);
  }
  return { ...collection, boxes, captures };
}

export function importLegacy(collection: Collection, legacy: LegacyImport): Collection {
  if (collection.migrated || legacy.backup === null) return collection;
  const importedSpecies = new Set<number>();
  const receipts = legacy.discoveries.filter(receipt => {
    if (importedSpecies.has(receipt.pokemon.id)) return false;
    importedSpecies.add(receipt.pokemon.id);
    return !collection.captures.some(capture => capture.pokemon.id === receipt.pokemon.id && capture.firstRecordedAt <= receipt.firstRecordedAt);
  });
  return { ...deposit(collection, receipts), migrated: true, legacyRewardIds: legacy.consumedIds, legacyBackup: legacy.backup };
}

export function applyCollectionCommand(collection: Collection, command: CollectionCommand): Collection {
  if (command.type === "deposit") return deposit(collection, command.receipts);
  if (command.type === "party-add" || command.type === "party-remove" || command.type === "party-leader" || command.type === "party-reorder") return applyPartyCommand(collection, command);
  if (command.type === "add-box") return { ...collection, boxes: [...collection.boxes, makeBox(collection.boxes.length + 1)] };
  if (command.type === "featured") {
    if (command.ids.length > 6 || new Set(command.ids).size !== command.ids.length || command.ids.some(id => !collection.captures.some(capture => capture.id === id)))
      throw new Error("Choose up to six caught Pokémon for your profile.");
    return { ...collection, featuredIds: [...command.ids] };
  }
  if (command.type === "destination" || command.type === "rename-box" || command.type === "wallpaper") {
    if (!collection.boxes.some(box => box.id === command.boxId)) throw new Error("This box is unavailable.");
    if (command.type === "destination") return { ...collection, destinationBoxId: command.boxId };
    if (command.type === "wallpaper") {
      if (!WALLPAPERS.some(wallpaper => wallpaper.id === command.wallpaper)) throw new Error("Choose a box background.");
      return { ...collection, boxes: collection.boxes.map(box => box.id === command.boxId ? { ...box, wallpaper: command.wallpaper } : box) };
    }
    const name = command.name.trim();
    if (!name || name.length > 32) throw new Error("Box names must contain 1–32 characters.");
    return { ...collection, boxes: collection.boxes.map(box => box.id === command.boxId ? { ...box, name } : box) };
  }
  const capture = collection.captures.find(item => item.id === command.id);
  if (!capture) throw new Error("This Pokémon is not in your PC.");
  if (command.type === "nickname") {
    const nickname = command.name.trim();
    if (nickname.length > 24) throw new Error("Nicknames can contain up to 24 characters.");
    return { ...collection, captures: collection.captures.map(item => item.id === capture.id ? { ...item, nickname } : item) };
  }
  if (command.type === "favorite") return { ...collection, captures: collection.captures.map(item => item.id === capture.id ? { ...item, favorite: command.favorite } : item) };
  if (!collection.boxes.some(box => box.id === command.boxId) || !Number.isInteger(command.slot) || command.slot < 0 || command.slot >= 30)
    throw new Error("Choose a slot in an available box.");
  const occupant = collection.captures.find(item => item.boxId === command.boxId && item.slot === command.slot);
  return { ...collection, captures: collection.captures.map(item => item.id === capture.id ? { ...item, boxId: command.boxId, slot: command.slot }
    : item.id === occupant?.id ? { ...item, boxId: capture.boxId, slot: capture.slot } : item) };
}
