import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "../../shared/storage/local";
import { POKEDEX_SPECIES_COUNT, type PokemonEncounter } from "./encounters";

function isSeenIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(id => Number.isSafeInteger(id) && id > 0 && id <= POKEDEX_SPECIES_COUNT);
}
function mergeIds(previous: number[], incoming: readonly number[]) {
  const next = [...new Set([...previous, ...incoming])];
  return next.length === previous.length ? previous : next;
}

/** Sightings never award captures or change the caught-species journal. */
export function useSeenPokemon(encounters: readonly PokemonEncounter[], currentId?: number) {
  const [seenIds, setSeenIds] = useState(() => [...new Set(readLocal("seen-pokemon-v1", [], isSeenIds))]);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    setSeenIds(previous => {
      return mergeIds(previous, [...encounters.map(entry => entry.pokemon.id), ...(currentId ? [currentId] : [])]);
    });
  }, [encounters, currentId]);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === "pokesql:seen-pokemon-v1") setSeenIds(previous => mergeIds(previous, readLocal("seen-pokemon-v1", [], isSeenIds)));
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  useEffect(() => {
    const next = mergeIds(seenIds, readLocal("seen-pokemon-v1", [], isSeenIds));
    if (next !== seenIds) { setSeenIds(next); return; }
    if (!writeLocal("seen-pokemon-v1", seenIds)) setSaveError(true);
  }, [seenIds]);
  return { seenIds, saveError };
}
