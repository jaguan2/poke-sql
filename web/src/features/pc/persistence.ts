import { applyCollectionCommand, createCollection, importLegacy } from "./model";
import { isCollection } from "./validation";
import { migrateCollection } from "./migrations";
import type { CapturedPokemon, Collection, CollectionCommand, LegacyImport } from "./types";

const DATABASE = "pokesql-collection-v1";
type Metadata = Omit<Collection, "captures">;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const captures = request.result.createObjectStore("captures", { keyPath: "id" });
      captures.createIndex("placement", ["boxId", "slot"], { unique: true });
      request.result.createObjectStore("metadata");
    };
    request.onblocked = () => { blocked = true; reject(new Error("Close other PokéSQL tabs to finish opening PC storage, then retry.")); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

// Every command reads the latest canonical state inside its write transaction.
// A catch and its slot commit together, even when several tabs catch at once.
export async function updateCollection(legacy: LegacyImport, command?: CollectionCommand): Promise<Collection> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["captures", "metadata"], "readwrite");
      const store = tx.objectStore("captures");
      const capturesRequest = store.getAll();
      const metadataRequest = tx.objectStore("metadata").get("state");
      let captures: CapturedPokemon[] | undefined;
      let metadata: Metadata | undefined;
      let metadataRead = false;
      let next: Collection;
      let failure: unknown;
      const apply = () => {
        if (!captures || !metadataRead) return;
        try {
          const previous = migrateCollection(metadata === undefined && captures.length === 0 ? createCollection() : { ...metadata, captures });
          // Recover verified outbox receipts first; the journal may already reflect
          // these wins after an interrupted first PC initialization.
          const awarded = command?.type === "deposit" ? applyCollectionCommand(previous, command) : previous;
          const imported = importLegacy(awarded, legacy);
          next = command && command.type !== "deposit" ? applyCollectionCommand(imported, command) : imported;
          if (!isCollection(next)) throw new Error("This PC change could not be saved safely.");
          const before = new Map(captures.map(capture => [capture.id, capture]));
          const changed = next.captures.filter(capture => before.get(capture.id) !== capture);
          // Remove both old placements before swapping to respect the unique index.
          for (const capture of changed) store.delete(capture.id);
          for (const capture of changed) store.put(capture);
          const { captures: _captures, ...settings } = next;
          tx.objectStore("metadata").put(settings, "state");
        } catch (error) { failure = error; tx.abort(); }
      };
      capturesRequest.onsuccess = () => { captures = capturesRequest.result; apply(); };
      metadataRequest.onsuccess = () => { metadata = metadataRequest.result; metadataRead = true; apply(); };
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error("PC storage is unavailable."));
    });
  } finally { db.close(); }
}
