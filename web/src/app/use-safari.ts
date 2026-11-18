import { useEffect, useReducer, useRef, useState } from "react";
import { changeSafariZone, recordSafariReply, walkSafari } from "../features/safari/model";
import { loadSafariSession } from "../features/safari/persistence";
import type { AssignmentId, SafariCheckReply, SafariFleeLimit, SafariPhase, SafariSession } from "../features/safari/types";
import type { Direction, ZoneId } from "../features/safari/zones";
import { weatherFor, zoneById } from "../features/safari/zones";
import type { QueryResult } from "../shared/sql/types";
import { writeLocal } from "../shared/storage/local";

interface State { session: SafariSession; phase: SafariPhase; results: QueryResult[]; message: string; error: string }
type Action =
  | { type: "move"; direction: Direction; chance: number; pick: number; id: string; date: string; fleeAfter: SafariFleeLimit }
  | { type: "zone"; id: ZoneId }
  | { type: "advance"; id: string }
  | { type: "edit"; sql: string }
  | { type: "reply"; id: string; reply: SafariCheckReply; at: string }
  | { type: "error"; message: string }
  | { type: "leave" };

function initialState(): State {
  const session = loadSafariSession();
  return { session, phase: session.encounter ? session.encounter.outcome === "active" ? "battle" : session.encounter.outcome : "roaming", results: [], message: "", error: "" };
}
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "move": {
      if (state.phase !== "roaming") return state;
      const weather = weatherFor(zoneById(state.session.zoneId), action.date);
      const session = walkSafari(state.session, action.direction, action.chance, action.pick, action.id, weather, action.fleeAfter);
      return { ...state, session, phase: session.encounter ? "rustling" : "roaming", error: "", message: "" };
    }
    case "zone": return { ...state, session: changeSafariZone(state.session, action.id), message: "", error: "" };
    case "advance": {
      if (state.session.encounter?.id !== action.id) return state;
      if (state.phase === "rustling") return { ...state, phase: "entering" };
      return state.phase === "entering" ? { ...state, phase: "battle" } : state;
    }
    case "edit": return state.phase !== "battle" ? state : action.sql.length <= 100_000 ? { ...state, session: { ...state.session, draft: action.sql }, error: "", message: "" }
      : { ...state, error: "Keep Safari queries below 100,000 characters." };
    case "error": return { ...state, error: action.message };
    case "leave": return { ...state, session: { ...state.session, encounter: null, draft: "", grassSteps: 0 }, phase: "roaming", results: [], message: "", error: "" };
    case "reply": {
      const encounter = state.session.encounter;
      if (state.phase !== "battle" || !encounter || encounter.id !== action.id || encounter.outcome !== "active") return state;
      if (action.reply.error) return { ...state, error: action.reply.error };
      const session = recordSafariReply(state.session, action.id, action.reply, action.at);
      if (session === state.session) return { ...state, error: "Could not verify this catch. Please try again; your chances are unchanged." };
      const outcome = session.encounter!.outcome;
      return { ...state, session, phase: outcome === "active" ? "battle" : outcome, results: action.reply.results ?? [], error: "",
        message: outcome === "caught" ? `${session.lastCatch!.pokemon.name} was added to your Pokédex!`
          : `Not quite. ${action.reply.safariFeedback ?? "Check the requested columns, filters, and ordering."}` };
    }
  }
}

export function useSafari(check: (sql: string, pokemonId: number, assignmentId: AssignmentId) => Promise<SafariCheckReply>, fleeAfter: SafariFleeLimit) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [saveError, setSaveError] = useState(false);
  const checking = useRef(false);
  const lastMove = useRef(-Infinity);
  useEffect(() => { if (!writeLocal("safari", state.session)) setSaveError(true); }, [state.session]);
  useEffect(() => {
    if ((state.phase !== "rustling" && state.phase !== "entering") || !state.session.encounter) return;
    const id = state.session.encounter.id;
    const duration = state.phase === "rustling" ? 400 : 1200;
    const timer = setTimeout(() => dispatch({ type: "advance", id }), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration);
    return () => clearTimeout(timer);
  }, [state.phase, state.session.encounter]);
  const move = (direction: Direction) => {
    if (checking.current || performance.now() - lastMove.current < 110) return;
    lastMove.current = performance.now();
    dispatch({ type: "move", direction, chance: Math.random(), pick: Math.random(), id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), fleeAfter });
  };
  const submit = async () => {
    const encounter = state.session.encounter;
    if (checking.current || state.phase !== "battle" || !encounter || !state.session.draft.trim()) return;
    checking.current = true;
    try {
      const reply = await check(state.session.draft, encounter.pokemonId, encounter.assignmentId);
      dispatch({ type: "reply", id: encounter.id, reply, at: new Date().toISOString() });
    } catch (error) { dispatch({ type: "error", message: (error as Error).message }); }
    finally { checking.current = false; }
  };
  return { ...state, saveError, actions: { move,
    changeZone: (id: ZoneId) => { if (!checking.current && state.phase === "roaming") dispatch({ type: "zone", id }); },
    editDraft: (sql: string) => { if (!checking.current) dispatch({ type: "edit", sql }); },
    submit,
    leave: () => { if (!checking.current) dispatch({ type: "leave" }); },
  } };
}
