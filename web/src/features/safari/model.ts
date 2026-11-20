import { isPokemonProfile } from "../../shared/pokemon/profile";
import { encounterLevel, isEncounterLevel } from "../../shared/pokemon/encounter-level";
import { hasShinySprite } from "../../shared/pokemon/sprites";
import { fieldAssignmentDraft, fieldAssignmentId, isFieldAssignment } from "./field-assignments";
import { EXPLORATION_LOCATIONS, chooseSpecies, isWalkable, isZoneId, movePosition, rustlingPatch, tileAt, zoneById } from "./zones";
import { isRegionLocation, isRegionId, regionTravel, regionFor, regionById } from "./regions";
import type { RegionId } from "./regions";
import type { Direction, Position, WeatherId, ZoneId } from "./zones";
import type { AssignmentId, SafariCheckReply, SafariEncounter, SafariFleeLimit, SafariSession } from "./types";

export const ASSIGNMENTS: readonly AssignmentId[] = ["field-notes", "stat-scan", "type-tracker", "ability-survey"];
export const SHINY_ODDS = 128;
export function createSafariSession(zoneId: ZoneId = "pallet-town"): SafariSession {
  return { version: 3, zoneId, position: { ...zoneById(zoneId).start }, direction: "up", steps: 0,
    grassSteps: 0, catches: 0, encounter: null, draft: "", lastCatch: null, visited: [zoneId] };
}
export const visitedLocations = (session: SafariSession): ZoneId[] => [...new Set<ZoneId>(["pallet-town", ...(session.visited ?? []), session.zoneId])];
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const isSafariFleeLimit = (value: unknown): value is SafariFleeLimit => value === null || value === 5 || value === 8;
function isSafariEncounter(value: unknown, zoneId: ZoneId): value is SafariEncounter {
  if (!record(value) || typeof value.id !== "string" || !value.id || value.id.length > 80
    || typeof value.pokemonId !== "number" || !zoneById(zoneId).species.some(species => species.id === value.pokemonId)
    || (value.level !== undefined && !isEncounterLevel(value.level))
    || (value.shiny !== undefined && typeof value.shiny !== "boolean")) return false;
  const validAssignment = isFieldAssignment(value.assignmentId)
    ? value.assignmentId === fieldAssignmentId(zoneId, value.pokemonId)
    : ASSIGNMENTS.some(id => id === value.assignmentId);
  if (!validAssignment) return false;
  const { attempts, fleeAfter, outcome } = value;
  if (!integer(attempts) || !isSafariFleeLimit(fleeAfter)) return false;
  if (outcome === "fled") return fleeAfter !== null && attempts === fleeAfter;
  if (outcome === "active") return fleeAfter === null || attempts < fleeAfter;
  return outcome === "caught" && attempts > 0 && (fleeAfter === null || attempts <= fleeAfter);
}
export function isSafariSession(value: unknown): value is SafariSession {
  if (!record(value) || value.version !== 3 || !isZoneId(value.zoneId) || !record(value.position)
    || !integer(value.position.x) || !integer(value.position.y) || !isWalkable(zoneById(value.zoneId), { x: value.position.x, y: value.position.y })
    || !["up", "down", "left", "right"].includes(String(value.direction)) || !integer(value.steps)
    || !integer(value.grassSteps) || value.grassSteps > 6 || !integer(value.catches)
    || typeof value.draft !== "string" || value.draft.length > 100_000
    || (value.visited !== undefined && (!Array.isArray(value.visited) || value.visited.length > EXPLORATION_LOCATIONS.length
      || !value.visited.every(isZoneId) || new Set(value.visited).size !== value.visited.length))) return false;
  if (value.regionPositions !== undefined) {
    if (!record(value.regionPositions)) return false;
    for (const [regionId, bookmark] of Object.entries(value.regionPositions)) {
      if (!isRegionId(regionId) || !record(bookmark) || !isRegionLocation(bookmark.zoneId)
        || regionFor(bookmark.zoneId)?.id !== regionId || !record(bookmark.position)
        || !integer(bookmark.position.x) || !integer(bookmark.position.y)
        || !isWalkable(zoneById(bookmark.zoneId), { x: bookmark.position.x, y: bookmark.position.y })
        || !["up", "down", "left", "right"].includes(String(bookmark.direction))) return false;
    }
  }
  const encounter = value.encounter;
  if (encounter !== null && !isSafariEncounter(encounter, value.zoneId)) return false;
  const caught = value.lastCatch;
  const caughtId = record(caught) && isPokemonProfile(caught.pokemon) ? caught.pokemon.id : undefined;
  if (caught !== null && (!record(caught) || typeof caught.encounterId !== "string" || !caught.encounterId
    || !isPokemonProfile(caught.pokemon) || !integer(caught.attempts) || caught.attempts < 1
    || !EXPLORATION_LOCATIONS.some(zone => zone.species.some(species => species.id === caughtId))
    || typeof caught.caughtAt !== "string" || !Number.isFinite(Date.parse(caught.caughtAt))
    || new Date(caught.caughtAt).toISOString() !== caught.caughtAt)) return false;
  if (encounter?.outcome === "fled" && record(caught) && caught.encounterId === encounter.id) return false;
  return encounter === null || encounter.outcome !== "caught" || (record(caught) && caught.encounterId === encounter.id && isPokemonProfile(caught.pokemon) && caught.pokemon.id === encounter.pokemonId);
}

export function restoreSafariSession(value: unknown): SafariSession | null {
  // The old 15x10 clearings used different coordinates. Keep the expedition,
  // active task and draft; relocate only the trainer to this route's trailhead.
  if (record(value) && value.version === 1 && isZoneId(value.zoneId) && record(value.position)
    && integer(value.position.x) && value.position.x < 15 && integer(value.position.y) && value.position.y < 10) {
    value = { ...value, version: 2, position: { ...zoneById(value.zoneId).start }, grassSteps: 0 };
  }
  // Existing expeditions keep unlimited attempts, including a partially solved task.
  if (record(value) && value.version === 2 && (value.encounter === null || (record(value.encounter) && typeof value.encounter.caught === "boolean"))) {
    const old = value.encounter;
    if (old) {
      const { caught, ...encounter } = old;
      value = { ...value, version: 3, encounter: { ...encounter, outcome: caught ? "caught" : "active", fleeAfter: null } };
    } else value = { ...value, version: 3 };
  }
  return isSafariSession(value) ? value : null;
}

// Random values/IDs are supplied by the controller so movement stays pure and
// React's repeated updater evaluation cannot roll a different encounter.
export function walkSafari(
  session: SafariSession, direction: Direction, chance: number, pick: number, encounterId: string,
  { weather = "clear", fleeAfter = null, date, trainerDays = 0, shinyRoll = 1 }: {
    weather?: WeatherId; fleeAfter?: SafariFleeLimit; date?: string; trainerDays?: number; shinyRoll?: number;
  } = {},
): SafariSession {
  if (session.encounter) return session;
  const portal = regionTravel(session.zoneId, session.position, direction);
  if (portal) return { ...session, zoneId: portal.to, position: { ...portal.arrival }, direction,
    steps: session.steps + 1, grassSteps: 0, visited: [...new Set([...visitedLocations(session), portal.to])] };
  const zone = zoneById(session.zoneId);
  const position = movePosition(zone, session.position, direction);
  if (position === session.position) return { ...session, direction };
  const inGrass = tileAt(zone, position) === "g";
  const grassSteps = inGrass ? session.grassSteps + 1 : 0;
  const patch = rustlingPatch(zone, session.catches, session.position);
  const rustling = patch && position.x === patch.x && position.y === patch.y;
  const encounter = inGrass && (rustling || grassSteps >= 6 || (grassSteps >= 2 && chance < 0.24));
  const next = { ...session, position, direction, steps: session.steps + 1, grassSteps: encounter ? 0 : grassSteps };
  if (!encounter) return next;
  const { id: pokemonId } = chooseSpecies(zone, pick, session.lastCatch?.pokemon.id, weather, date);
  const assignmentId = fieldAssignmentId(zone.id, pokemonId) ?? ASSIGNMENTS[session.catches % ASSIGNMENTS.length];
  return { ...next, encounter: { id: encounterId, level: encounterLevel(encounterId, trainerDays), pokemonId,
    shiny: shinyRoll < 1 / SHINY_ODDS && hasShinySprite(pokemonId),
    assignmentId, attempts: 0, outcome: "active", fleeAfter }, draft: isFieldAssignment(assignmentId) ? fieldAssignmentDraft(assignmentId) : "-- Write your catch query here.\nSELECT " };
}

export function recordSafariReply(session: SafariSession, id: string, reply: SafariCheckReply, at: string): SafariSession {
  const encounter = session.encounter;
  if (!encounter || encounter.id !== id || encounter.outcome !== "active" || reply.error || typeof reply.passed !== "boolean") return session;
  const pokemon = reply.safariPokemon;
  if (reply.passed && pokemon?.id !== encounter.pokemonId) return session;
  const attempts = encounter.attempts + 1;
  const caught = reply.passed && pokemon !== undefined;
  const outcome = caught ? "caught" : encounter.fleeAfter !== null && attempts >= encounter.fleeAfter ? "fled" : "active";
  return { ...session, encounter: { ...encounter, attempts, outcome }, catches: session.catches + (caught ? 1 : 0),
    lastCatch: caught ? { encounterId: id, pokemon, attempts, caughtAt: at } : session.lastCatch };
}
export function changeSafariZone(session: SafariSession, zoneId: ZoneId): SafariSession {
  if (!canTravelTo(session, zoneId)) return session;
  return arrive(session, zoneId, zoneById(zoneId).start, "up");
}
export function canTravelTo(session: SafariSession, zoneId: ZoneId): boolean {
  return !session.encounter && zoneId !== session.zoneId;
}

function arrive(session: SafariSession, zoneId: ZoneId, position: Position, direction: Direction): SafariSession {
  const leaving = regionFor(session.zoneId);
  const regionPositions = leaving && isRegionLocation(session.zoneId) && leaving.id !== regionFor(zoneId)?.id
    ? { ...session.regionPositions, [leaving.id]: { zoneId: session.zoneId, position: session.position, direction: session.direction } }
    : session.regionPositions;
  return { ...session, zoneId, position: { ...position }, direction, grassSteps: 0,
    visited: [...new Set([...visitedLocations(session), zoneId])], ...(regionPositions ? { regionPositions } : {}) };
}
export function changeSafariRegion(session: SafariSession, id: RegionId): SafariSession {
  if (session.encounter || regionFor(session.zoneId)?.id === id) return session;
  const saved = session.regionPositions?.[id];
  const destination = saved?.zoneId ?? regionById(id).start;
  return arrive(session, destination, saved?.position ?? zoneById(destination).start, saved?.direction ?? "up");
}
