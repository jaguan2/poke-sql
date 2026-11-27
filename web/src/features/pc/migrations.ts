import { isCollection } from "./validation";
import type { Collection } from "./types";

/** Additive migration, run inside the same transaction as the requested command. */
export function migrateCollection(value: unknown): Collection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PC data could not be read. Your original saved data has been kept.");
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== undefined && record.schemaVersion !== 1 && record.schemaVersion !== 2)
    throw new Error("This PC save needs a newer version of PokéSQL. Your original saved data has been kept.");
  if (record.schemaVersion === 2) {
    if (!isCollection(record)) throw new Error("PC data could not be read. Your original saved data has been kept.");
    return record;
  }
  const { captures: _captures, ...metadata } = record;
  const upgraded = { ...record, schemaVersion: 2, partyIds: [], migrationBackup: { schemaVersion: 1, metadata } };
  if (!isCollection(upgraded)) throw new Error("PC data could not be migrated. Your original saved data has been kept.");
  return upgraded;
}
