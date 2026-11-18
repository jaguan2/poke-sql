import { isPokemonProfile } from "../../shared/pokemon/profile";
import { chooseSpecies, isWalkable, isZoneId, movePosition, tileAt, zoneById } from "./zones";
import type { Direction, ZoneId } from "./zones";
import type { AssignmentId, SafariSession } from "./types";

export const ASSIGNMENTS: readonly AssignmentId[] = ["field-notes", "stat-scan", "type-tracker", "ability-survey"];
export function createSafariSession(): SafariSession {
  return { version: 1, zoneId: "forest", position: { ...zoneById("forest").start }, direction: "up", steps: 0,
    grassSteps: 0, catches: 0, encounter: null, draft: "", lastCatch: null };
}
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function isSafariSession(value: unknown): value is SafariSession {
  if (!record(value) || value.version !== 1 || !isZoneId(value.zoneId) || !record(value.position)
    || !integer(value.position.x) || !integer(value.position.y) || !isWalkable(zoneById(value.zoneId), { x: value.position.x, y: value.position.y })
    || !["up", "down", "left", "right"].includes(String(value.direction)) || !integer(value.steps)
    || !integer(value.grassSteps) || value.grassSteps > 6 || !integer(value.catches)
    || typeof value.draft !== "string" || value.draft.length > 100_000) return false;
  const encounter = value.encounter;
  if (encounter !== null && (!record(encounter) || typeof encounter.id !== "string" || encounter.id.length > 80 || !encounter.id
    || !zoneById(value.zoneId).species.some(species => species.id === encounter.pokemonId)
    || !ASSIGNMENTS.includes(encounter.assignmentId as AssignmentId) || !integer(encounter.attempts) || typeof encounter.caught !== "boolean")) return false;
  const caught = value.lastCatch;
  const caughtId = record(caught) && isPokemonProfile(caught.pokemon) ? caught.pokemon.id : undefined;
  if (caught !== null && (!record(caught) || typeof caught.encounterId !== "string" || !caught.encounterId
    || !isPokemonProfile(caught.pokemon) || !integer(caught.attempts) || caught.attempts < 1
    || !["forest", "wetlands", "ridge"].some(id => zoneById(id as ZoneId).species.some(species => species.id === caughtId))
    || typeof caught.caughtAt !== "string" || !Number.isFinite(Date.parse(caught.caughtAt))
    || new Date(caught.caughtAt).toISOString() !== caught.caughtAt)) return false;
  return encounter === null || !encounter.caught || (record(caught) && caught.encounterId === encounter.id && isPokemonProfile(caught.pokemon) && caught.pokemon.id === encounter.pokemonId);
}

// Random values/IDs are supplied by the controller so movement stays pure and
// React's repeated updater evaluation cannot roll a different encounter.
export function walkSafari(session: SafariSession, direction: Direction, chance: number, pick: number, encounterId: string): SafariSession {
  if (session.encounter) return session;
  const zone = zoneById(session.zoneId);
  const position = movePosition(zone, session.position, direction);
  if (position === session.position) return { ...session, direction };
  const inGrass = tileAt(zone, position) === "g";
  const grassSteps = inGrass ? session.grassSteps + 1 : 0;
  const rustling = position.x === zone.rustle.x && position.y === zone.rustle.y;
  const encounter = inGrass && (rustling || grassSteps >= 6 || (grassSteps >= 2 && chance < 0.24));
  const next = { ...session, position, direction, steps: session.steps + 1, grassSteps: encounter ? 0 : grassSteps };
  if (!encounter) return next;
  return { ...next, encounter: { id: encounterId, pokemonId: chooseSpecies(zone, pick, session.lastCatch?.pokemon.id).id,
    assignmentId: ASSIGNMENTS[session.catches % ASSIGNMENTS.length], attempts: 0, caught: false }, draft: "-- Write your catch query here.\nSELECT " };
}
export function changeSafariZone(session: SafariSession, zoneId: ZoneId): SafariSession {
  if (session.encounter || zoneId === session.zoneId) return session;
  return { ...session, zoneId, position: { ...zoneById(zoneId).start }, direction: "up", grassSteps: 0 };
}
