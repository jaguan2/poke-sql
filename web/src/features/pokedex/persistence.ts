import { isPokemonEncounters } from "./encounters";
import type { PokemonEncounter } from "./encounters";

// Keep the legacy array/key. Validate individual rows when recovering an old
// save, and preserve its exact bytes before any effect can replace it.
export function loadEncounters(): { entries: PokemonEncounter[]; canSave: boolean; recovered: boolean } {
  let raw: string | null;
  try { raw = localStorage.getItem("pokesql:encounters"); }
  catch { return { entries: [], canSave: false, recovered: false }; }
  if (raw === null) return { entries: [], canSave: true, recovered: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (isPokemonEncounters(parsed)) return { entries: parsed, canSave: true, recovered: false };
  const entries: PokemonEncounter[] = [];
  for (const entry of Array.isArray(parsed) ? parsed : []) {
    if (!isPokemonEncounters([entry])) continue;
    const existing = entries.find(previous => previous.pokemon.id === entry.pokemon.id);
    if (!existing) entries.push(entry);
    else {
      existing.bestGuessCount = Math.min(existing.bestGuessCount, entry.bestGuessCount);
      existing.sources = [...new Set([...existing.sources, ...entry.sources])];
      if (entry.firstFoundAt < existing.firstFoundAt) existing.firstFoundAt = entry.firstFoundAt;
    }
  }
  try {
    localStorage.setItem("pokesql:encounters-recovery", raw);
    return { entries, canSave: true, recovered: true };
  } catch {
    // If preserving the old bytes fails, never overwrite the original save.
    return { entries, canSave: false, recovered: true };
  }
}
