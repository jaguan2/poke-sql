import { useEffect, useReducer, useRef, useState } from "react";
import { changeSafariZone, createSafariSession, isSafariSession, walkSafari } from "../features/safari/model";
import type { AssignmentId, SafariCheckReply, SafariPhase, SafariSession } from "../features/safari/types";
import type { Direction, ZoneId } from "../features/safari/zones";
import type { QueryResult } from "../shared/sql/types";
import { readLocal, writeLocal } from "../shared/storage/local";

interface State { session: SafariSession; phase: SafariPhase; results: QueryResult[]; message: string; error: string }
type Action =
  | { type: "move"; direction: Direction; chance: number; pick: number; id: string }
  | { type: "zone"; id: ZoneId }
  | { type: "ready"; id: string }
  | { type: "edit"; sql: string }
  | { type: "reply"; id: string; reply: SafariCheckReply; at: string }
  | { type: "error"; message: string }
  | { type: "leave" };

function initialState(): State {
  const session = readLocal("safari", createSafariSession(), isSafariSession);
  return { session, phase: session.encounter ? session.encounter.caught ? "caught" : "battle" : "roaming", results: [], message: "", error: "" };
}
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "move": {
      if (state.phase !== "roaming") return state;
      const session = walkSafari(state.session, action.direction, action.chance, action.pick, action.id);
      return { ...state, session, phase: session.encounter ? "entering" : "roaming", error: "", message: "" };
    }
    case "zone": return { ...state, session: changeSafariZone(state.session, action.id), message: "", error: "" };
    case "ready": return state.phase === "entering" && state.session.encounter?.id === action.id ? { ...state, phase: "battle" } : state;
    case "edit": return action.sql.length <= 100_000 ? { ...state, session: { ...state.session, draft: action.sql }, error: "", message: "" }
      : { ...state, error: "Keep Safari queries below 100,000 characters." };
    case "error": return { ...state, error: action.message };
    case "leave": return { ...state, session: { ...state.session, encounter: null, draft: "", grassSteps: 0 }, phase: "roaming", results: [], message: "", error: "" };
    case "reply": {
      const encounter = state.session.encounter;
      if (!encounter || encounter.id !== action.id || encounter.caught) return state;
      if (action.reply.error) return { ...state, error: action.reply.error };
      const attempts = encounter.attempts + 1;
      const pokemon = action.reply.safariPokemon;
      const passed = action.reply.passed === true && pokemon?.id === encounter.pokemonId;
      return { ...state, phase: passed ? "caught" : "battle", results: action.reply.results ?? [], error: "",
        message: passed ? `${pokemon.name} was added to your Pokédex!` : "Not quite. Check the requested columns, filters, and ordering, then try again. Your Pokémon is still here.",
        session: { ...state.session, encounter: { ...encounter, attempts, caught: passed },
          catches: state.session.catches + (passed ? 1 : 0),
          lastCatch: passed ? { encounterId: encounter.id, pokemon, attempts, caughtAt: action.at } : state.session.lastCatch } };
    }
  }
}

export function useSafari(check: (sql: string, pokemonId: number, assignmentId: AssignmentId) => Promise<SafariCheckReply>) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [saveError, setSaveError] = useState(false);
  const checking = useRef(false);
  const lastMove = useRef(-Infinity);
  useEffect(() => { if (!writeLocal("safari", state.session)) setSaveError(true); }, [state.session]);
  useEffect(() => {
    if (state.phase !== "entering" || !state.session.encounter) return;
    const id = state.session.encounter.id;
    const timer = setTimeout(() => dispatch({ type: "ready", id }), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950);
    return () => clearTimeout(timer);
  }, [state.phase, state.session.encounter]);
  const move = (direction: Direction) => {
    if (checking.current || performance.now() - lastMove.current < 110) return;
    lastMove.current = performance.now();
    dispatch({ type: "move", direction, chance: Math.random(), pick: Math.random(), id: crypto.randomUUID() });
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
