import { createBag, useBagItem, type BagItemId } from "../features/safari/bag-model";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { visibleSafariPokemonId, changeSafariRegion, changeSafariZone, recordSafariReply, walkSafari } from "../features/safari/model";
import type { RegionId } from "../features/safari/regions";
import { loadSafariSession } from "../features/safari/persistence";
import { SAFARI_TRANSITIONS } from "../features/safari/animation";
import type { AssignmentId, SafariCaptureContext, SafariCatch, SafariCheckReply, SafariFleeLimit, SafariPhase, SafariQueryMode, SafariSession } from "../features/safari/types";
import type { Direction, ZoneId } from "../features/safari/zones";
import { weatherFor, zoneById } from "../features/safari/zones";
import type { QueryResult } from "../shared/sql/types";
import { writeLocal } from "../shared/storage/local";
import { legacyEncounterLevel } from "../shared/pokemon/encounter-level";
import { trainerAgeDays } from "../shared/trainer/identity";

interface State { session: SafariSession; phase: SafariPhase; results: QueryResult[]; message: string; error: string }
type Action =
  | { type: "move"; direction: Direction; chance: number; pick: number; id: string; date: string; fleeAfter: SafariFleeLimit; trainerDays: number; shinyRoll: number }
  | { type: "zone"; id: ZoneId }
  | { type: "region"; id: RegionId }
  | { type: "advance"; id: string }
  | { type: "edit"; sql: string }
  | { type: "reply"; id: string; reply: SafariCheckReply; at: string; mode: SafariQueryMode }
  | { type: "restore-catch"; caught: SafariCatch; shiny: boolean }
  | { type: "error"; message: string }
  | { type: "leave" }
  | { type: "item"; id: BagItemId };

function initialState(): State {
  const session = loadSafariSession();
  return { session, phase: session.encounter ? session.encounter.outcome === "active" ? "battle" : session.encounter.outcome : "roaming", results: [], message: "", error: "" };
}
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "move": {
      if (state.phase !== "roaming") return state;
      const weather = weatherFor(zoneById(state.session.zoneId), action.date);
      const session = walkSafari(state.session, action.direction, action.chance, action.pick, action.id,
        { weather, fleeAfter: action.fleeAfter, date: action.date, trainerDays: action.trainerDays, shinyRoll: action.shinyRoll });
      return { ...state, session, phase: session.encounter ? "rustling" : "roaming", error: "", message: "" };
    }
    case "item": {
      if (state.phase !== "roaming") return state;
      const previous = state.session.bag ?? createBag();
      const bag = useBagItem(previous, state.session.catches, action.id);
      return bag === previous ? state : { ...state, session: { ...state.session, bag } };
    }
    case "zone": return { ...state, session: changeSafariZone(state.session, action.id), message: "", error: "" };
    case "region": return { ...state, session: changeSafariRegion(state.session, action.id), message: "", error: "" };
    case "advance": {
      if (state.session.encounter?.id !== action.id) return state;
      const transition = SAFARI_TRANSITIONS[state.phase];
      return transition ? { ...state, phase: transition.next } : state;
    }
    case "edit": return state.phase !== "battle" ? state : action.sql.length <= 100_000 ? { ...state, session: { ...state.session, draft: action.sql }, error: "", message: "" }
      : { ...state, error: "Keep Safari queries below 100,000 characters." };
    case "error": return { ...state, error: action.message };
    case "restore-catch": {
      const encounter = state.session.encounter;
      if (!encounter || encounter.outcome !== "active" || encounter.id !== action.caught.encounterId || encounter.pokemonId !== action.caught.pokemon.id) return state;
      return { ...state, phase: "caught", session: { ...state.session, catches: state.session.catches + 1,
        lastCatch: action.caught, encounter: { ...encounter, shiny: action.shiny, outcome: "caught", attempts: action.caught.attempts } } };
    }
    case "leave": return { ...state, session: { ...state.session, encounter: null, draft: "", grassSteps: 0 }, phase: "roaming", results: [],
      message: state.session.encounter?.outcome === "active" ? "You got away safely." : "", error: "" };
    case "reply": {
      const encounter = state.session.encounter;
      if (state.phase !== "battle" || !encounter || encounter.id !== action.id || encounter.outcome !== "active") return state;
      if (action.reply.error) return { ...state, error: action.reply.error };
      if (action.mode === "preview") {
        const results = action.reply.results ?? [];
        const count = results[0]?.values.length ?? 0;
        const rows = `${count}${results[0]?.truncated ? "+" : ""} ${count === 1 ? "row" : "rows"} returned.`;
        const hint = encounter.assignmentId === "tracking" && count > 1 ? " Use another clue to narrow the search." : "";
        return { ...state, results, error: "", message: `${rows}${hint}` };
      }
      const session = recordSafariReply(state.session, action.id, action.reply, action.at);
      if (session === state.session) return { ...state, error: "Could not verify this catch. Please try again; your chances are unchanged." };
      const outcome = session.encounter!.outcome;
      return { ...state, session, phase: outcome === "active" ? "battle" : outcome === "caught" ? "catching" : outcome, results: action.reply.results ?? [], error: "",
        message: outcome === "caught" ? `${session.lastCatch!.pokemon.name} was added to your Pokédex!`
          : `Not quite. ${action.reply.safariFeedback ?? "Check the requested columns, filters, and ordering."}` };
    }
  }
}

export function useSafari(check: (sql: string, pokemonId: number, assignmentId: AssignmentId, context: SafariCaptureContext, mode: SafariQueryMode) => Promise<SafariCheckReply>, fleeAfter: SafariFleeLimit, trainerIssuedAt: string) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [saveError, setSaveError] = useState(false);
  const checking = useRef(false);
  const restoreCatch = useCallback((caught: SafariCatch, shiny: boolean) => dispatch({ type: "restore-catch", caught, shiny }), []);
  useEffect(() => { if (!writeLocal("safari", state.session)) setSaveError(true); }, [state.session]);
  useEffect(() => {
    const transition = SAFARI_TRANSITIONS[state.phase];
    if (!transition || !state.session.encounter) return;
    const id = state.session.encounter.id;
    const timer = setTimeout(() => dispatch({ type: "advance", id }), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : transition.durationMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.session.encounter]);
  const move = (direction: Direction) => {
    if (checking.current) return;
    const now = new Date();
    const shinyRoll = crypto.getRandomValues(new Uint16Array(1))[0] / 2 ** 16;
    dispatch({ type: "move", direction, chance: Math.random(), pick: Math.random(), shinyRoll, id: crypto.randomUUID(),
      date: now.toISOString().slice(0, 10), fleeAfter, trainerDays: trainerAgeDays(trainerIssuedAt, now.getTime()) });
  };
  const run = async (mode: SafariQueryMode) => {
    const encounter = state.session.encounter;
    if (checking.current || state.phase !== "battle" || !encounter || !state.session.draft.trim()) return;
    checking.current = true;
    try {
      const reply = await check(state.session.draft, encounter.pokemonId, encounter.assignmentId, {
        id: encounter.id, level: encounter.level ?? legacyEncounterLevel(encounter.id), shiny: encounter.shiny === true,
        zoneId: state.session.zoneId, attempts: encounter.attempts,
      }, mode);
      dispatch({ type: "reply", id: encounter.id, reply, at: reply.caughtAt ?? new Date().toISOString(), mode });
    } catch (error) { dispatch({ type: "error", message: (error as Error).message }); }
    finally { checking.current = false; }
  };
  return { ...state, saveError, visiblePokemonId: visibleSafariPokemonId(state.session.encounter, state.phase), actions: { move,
    restoreCatch,
    useItem: (id: BagItemId) => { if (!checking.current) dispatch({ type: "item", id }); },
    changeZone: (id: ZoneId) => { if (!checking.current && state.phase === "roaming") dispatch({ type: "zone", id }); },
    changeRegion: (id: RegionId) => { if (!checking.current && state.phase === "roaming") dispatch({ type: "region", id }); },
    editDraft: (sql: string) => { if (!checking.current) dispatch({ type: "edit", sql }); },
    submit: () => void run("catch"),
    preview: () => void run("preview"),
    leave: () => { if (!checking.current) dispatch({ type: "leave" }); },
  } };
}
