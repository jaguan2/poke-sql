import { useSeenPokemon } from "../features/pokedex/use-seen-pokemon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { encounterLevel, legacyEncounterLevel } from "../shared/pokemon/encounter-level";
import { cancelQuery, checkChallenge, checkSafari, initDb, queryMystery, resetDb, runQuery, startMystery } from "./database/client";
import type { TableInfo } from "../shared/sql/types";
import type { AchievementCatalog } from "../features/pokedex/types";
import { MYSTERY_INITIAL_QUERY, mysterySolved, recordMysteryGuess } from "../features/mystery/model";
import type { MysteryRound } from "../features/mystery/model";
import { createDailyMysteryRound, isDailyMysteryRound, utcDateKey } from "../features/mystery/daily";
import type { DailyMysteryRound } from "../features/mystery/daily";
import { useUtcDay } from "../features/mystery/use-utc-day";
import { useEncounters } from "../features/pokedex/use-encounters";
import { useSafari } from "./use-safari";
import type { AssignmentId, SafariCaptureContext, SafariQueryMode } from "../features/safari/types";
import type { SafariFleeLimit } from "../features/safari/types";
import { isSafariFleeLimit } from "../features/safari/model";
import { CHALLENGES } from "../features/practice/challenges";
import { SAMPLE_QUERIES } from "../features/practice/samples";
import { isStringArray, readLocal, writeLocal } from "../shared/storage/local";
import { prepareOffline } from "../shared/offline";
import ballThemes from "../shared/pokemon/ball-themes.json" with { type: "json" };
import { isTrainerId, isTrainerName, MAX_TRAINER_NAME } from "../shared/trainer/profile";
import { POKEDEX_SPECIES_COUNT } from "../features/pokedex/encounters";
import type { TrainerId } from "../shared/trainer/profile";
import { createTrainerIdentity, isTrainerIdentity, trainerAgeDays } from "../shared/trainer/identity";
import type { PokedexView } from "../features/pokedex/PersonalPokedex";
import type { SavedQuery, RunState, PracticeSelection, QueryContext } from "./workspace-types";
import type { NavigationId, WorkspaceView } from "./navigation";
import type { CatalogFilters, CatalogKind } from "../features/practice/types";
import { useCollection } from "../features/pc/use-collection";
import { collectionDiscoveries, dailyRewardId, randomRewardId, readLegacyCollection, restoreRandomRound, restoreSolvedRound } from "./capture-rewards";
import { zoneById } from "../features/safari/zones";

const INITIAL_QUERY = "SELECT * FROM pokedex LIMIT 15;";
const isBallTheme = (value: unknown): value is string => typeof value === "string" && ballThemes.some(theme => theme.id === value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isDrafts = (v: unknown): v is Record<string, string> => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(x => typeof x === "string");
const isSaved = (v: unknown): v is SavedQuery[] => Array.isArray(v) && v.every(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.sql === "string");
/** Owns workspace transitions, async query contexts, and persistence. */
export function useWorkspace() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(() => readLocal("drafts", { sandbox: INITIAL_QUERY }, isDrafts));
  const [selection, setSelection] = useState<PracticeSelection>(null);
  const [randomMysteryRound, setRandomMysteryRound] = useState<MysteryRound | null>(restoreRandomRound);
  const [dailyMysteryRound, setDailyMysteryRound] = useState<DailyMysteryRound | null>(() => readLocal("daily-mystery-round", null, isDailyMysteryRound));
  const [view, setView] = useState<WorkspaceView>("workspace");
  const referenceContext = useRef<"workspace" | "safari">("workspace");
  const [catalogFilters, setCatalogFilters] = useState<Record<CatalogKind, CatalogFilters>>({ samples: { search: "", category: "all", status: "all" }, challenges: { search: "", category: "all", status: "all" } });
  const personalizationReturn = useRef<Exclude<typeof view, "profiles" | "settings">>("workspace");
  const showPokedex = view === "pokedex";
  const [pokedexView, setPokedexView] = useState<PokedexView>("collection");
  const showSafari = view === "safari";
  const showProfiles = view === "profiles";
  const showSettings = view === "settings";
  const showPersonalization = showProfiles || showSettings;
  const showWorkspace = view === "workspace";
  const catalogKind: CatalogKind | null = view === "get-started" ? "samples" : view === "challenges" ? "challenges" : null;
  const libraryView = view === "schema" || view === "history" || view === "saved" ? view : null;
  const safariContext = showSafari || (view === "schema" && referenceContext.current === "safari");
  const [mysteryMode, setMysteryMode] = useState<"daily" | "random">("daily");
  const today = useUtcDay();
  const mysteryRound = mysteryMode === "daily" ? dailyMysteryRound : randomMysteryRound;
  const [completed, setCompleted] = useState(() => readLocal("completed", [], isStringArray));
  const [history, setHistory] = useState(() => readLocal("history", [], isStringArray).slice(0, 30));
  const [saved, setSaved] = useState(() => readLocal("saved", [], isSaved));
  const [runState, setRunState] = useState<RunState>({ status: "idle", message: "Choose a Get started question, or write SQL above and select Run." });
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [challengeSchema, setChallengeSchema] = useState<TableInfo[]>([]);
  const [achievementCatalog, setAchievementCatalog] = useState<AchievementCatalog | null>(null);
  const [datasetUpdateAvailable, setDatasetUpdateAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [storageError, setStorageError] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState("");
  const [ballTheme, setBallTheme] = useState(() => readLocal("ball-theme", "poke-ball", isBallTheme));
  const [trainer, setTrainer] = useState<TrainerId>(() => readLocal("trainer", "red", isTrainerId));
  const [trainerName, setTrainerName] = useState(() => readLocal("trainer-name", "", isTrainerName));
  const [trainerIdentity] = useState(() => readLocal("trainer-id", createTrainerIdentity(), isTrainerIdentity));
  const [autocomplete, setAutocomplete] = useState(() => readLocal("autocomplete", true, isBoolean));
  const [safariFleeAfter, setSafariFleeAfter] = useState<SafariFleeLimit>(() => readLocal("safari-flee-after", null, isSafariFleeLimit));
  const [profileSaveError, setProfileSaveError] = useState(false);
  const pc = useCollection(readLegacyCollection);
  const activeChallenge = selection?.kind === "challenge" ? selection.id : null;
  const isMystery = selection?.kind === "mystery";
  const challenge = CHALLENGES.find(c => c.id === activeChallenge);
  const sample = selection?.kind === "sample" ? SAMPLE_QUERIES.find(s => s.id === selection.id) : undefined;
  const practice = challenge ? { ...challenge, sql: challenge.solution } : sample;
  const editorSchema = challenge || isMystery || safariContext ? challengeSchema : schema;
  const activeNavigation: NavigationId | null = view !== "workspace" ? view : isMystery ? "mystery" : challenge ? "challenges" : sample ? "get-started" : "workspace";
  const completedCount = CHALLENGES.filter(item => completed.includes(item.id)).length;
  const draftKey = isMystery ? (mysteryMode === "daily" ? "mystery-daily" : "mystery") : activeChallenge ?? (sample ? `sample:${sample.id}` : "sandbox");
  const query = drafts[draftKey] ?? (isMystery ? MYSTERY_INITIAL_QUERY : practice ? `-- ${practice.title}\nSELECT ` : INITIAL_QUERY);

  const persist = useCallback((key: string, value: unknown) => {
    const stored = writeLocal(key, value);
    if (!stored) setStorageError(true);
    return stored;
  }, []);
  const editQuery = useCallback((value: string, key = draftKey) => {
    // A grade describes the submitted answer, not subsequent edits.
    setRunState(previous => previous.status === "ok" && previous.passed !== undefined
      ? { status: "idle", message: "Answer changed. Check it again when you are ready." } : previous);
    setDrafts(previous => {
      const next = { ...previous, [key]: value };
      return next;
    });
  }, [draftKey]);
  const onEditorChange = useCallback((value: string) => editQuery(value), [editQuery]);

  useEffect(() => { persist("drafts", drafts); }, [drafts, persist]);
  useEffect(() => { persist("history", history); }, [history, persist]);
  useEffect(() => { persist("completed", completed); }, [completed, persist]);
  useEffect(() => { persist("mystery-round", randomMysteryRound); }, [randomMysteryRound, persist]);
  useEffect(() => { persist("daily-mystery-round", dailyMysteryRound); }, [dailyMysteryRound, persist]);
  useEffect(() => { if (!writeLocal("trainer-id", trainerIdentity)) setProfileSaveError(true); }, [trainerIdentity]);

  useEffect(() => {
    let disposed = false;
    initDb().then(reply => {
      if (disposed) return;
      setSchema(reply.schema); setChallengeSchema(reply.challengeSchema ?? reply.schema); setNotice(reply.notice); setReady(true);
      setAchievementCatalog(reply.achievementCatalog ?? null);
      setDatasetUpdateAvailable(reply.datasetUpdateAvailable ?? false);
    }).catch(error => { if (!disposed) setLoadError((error as Error).message); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => prepareOffline(setOfflineStatus), []);
  useEffect(() => {
    document.documentElement.dataset.ballTheme = ballTheme;
    return () => { delete document.documentElement.dataset.ballTheme; };
  }, [ballTheme]);

  const runSafariCheck = useCallback(async (sql: string, pokemonId: number, assignmentId: AssignmentId, context: SafariCaptureContext, mode: SafariQueryMode) => {
    if (!ready || busyRef.current) throw new Error("Wait for the current query before checking a catch.");
    busyRef.current = true; setBusy(true);
    setHistory(previous => [sql, ...previous.filter(item => item !== sql)].slice(0, 30));
    try {
      const reply = await checkSafari(sql, pokemonId, assignmentId, mode);
      setSchema(reply.schema);
      if (mode === "catch" && !reply.error && reply.passed && reply.safariPokemon?.id === pokemonId) {
        const at = new Date().toISOString();
        await pc.award({ id: `safari:${context.id}`, pokemon: reply.safariPokemon, source: "safari", sources: ["safari"],
          level: context.level, shiny: context.shiny, ball: ballTheme, caughtAt: at, firstRecordedAt: at,
          location: zoneById(context.zoneId).name, attempts: context.attempts + 1, sql });
        return { ...reply, caughtAt: at };
      }
      return reply;
    } catch (error) {
      try { setSchema((await initDb()).schema); } catch { /* The query error stays visible. */ }
      throw error;
    } finally { busyRef.current = false; setBusy(false); }
  }, [ready, pc.award, ballTheme]);
  const safari = useSafari(runSafariCheck, safariFleeAfter, trainerIdentity.issuedAt);
  const discoveries = useMemo(() => collectionDiscoveries(pc.collection), [pc.collection]);
  const { encounters, saveError: encounterSaveError, recovered: encountersRecovered } = useEncounters(dailyMysteryRound, randomMysteryRound, safari.session.lastCatch, discoveries);
  const { seenIds, saveError: seenSaveError } = useSeenPokemon(encounters, showSafari ? safari.visiblePokemonId : undefined);
  const restoreSafariCatch = safari.actions.restoreCatch;
  useEffect(() => {
    if (!pc.collection || busyRef.current) return;
    const captures = pc.collection.captures;
    setDailyMysteryRound(previous => previous ? restoreSolvedRound(previous, captures.find(capture => capture.id === dailyRewardId(previous.date, previous.scheduleVersion))) : previous);
    setRandomMysteryRound(previous => previous ? restoreSolvedRound(previous, captures.find(capture => capture.id === randomRewardId(previous))) : previous);
    const encounter = safari.session.encounter;
    const capture = encounter?.outcome === "active" ? captures.find(item => item.id === `safari:${encounter.id}` && item.source === "safari") : undefined;
    if (capture?.caughtAt && encounter && (encounter.fleeAfter === null || capture.attempts <= encounter.fleeAfter)) restoreSafariCatch({
      encounterId: encounter.id, pokemon: capture.pokemon, attempts: capture.attempts, caughtAt: capture.caughtAt,
    }, capture.shiny === true);
  }, [pc.collection, busy, safari.session.encounter, restoreSafariCatch]);

  const execute = useCallback(async (sql: string, context: QueryContext) => {
    if (!ready || busyRef.current || !sql.trim()) return;
    busyRef.current = true; setBusy(true); setNotice(undefined);
    setHistory(previous => {
      const next = [sql, ...previous.filter(item => item !== sql)].slice(0, 30);
      return next;
    });
    try {
      const reply = context.kind === "practice" ? await runQuery(sql) : context.kind === "challenge"
        ? await checkChallenge(sql, context.challengeId) : await queryMystery(sql, context.targetId);
      setSchema(reply.schema); setNotice(reply.notice);
      if (reply.error) setRunState({ status: "error", message: reply.error });
      else {
        setRunState({ status: "ok", results: reply.results ?? [], ms: reply.ms ?? 0, passed: reply.passed, mysteryGuess: !!reply.mysteryGuess });
        if (reply.mysteryGuess) {
          const feedback = reply.mysteryGuess;
          if ((context.kind === "daily-mystery" || context.kind === "random-mystery") && feedback.matched && feedback.pokemon.id === context.targetId) {
            const at = new Date().toISOString();
            const source = context.kind === "daily-mystery" ? "daily" : "random";
            await pc.award({ id: context.rewardId, pokemon: feedback.pokemon, source, sources: [source],
              level: context.level, ball: context.ball, caughtAt: at, firstRecordedAt: at, location: null,
              attempts: context.attempts + 1, sql: sql.length <= 100_000 ? sql : null });
          }
          if (context.kind === "daily-mystery") {
            setDailyMysteryRound(previous => previous && previous.date === context.date && previous.targetId === context.targetId
              ? { ...previous, ...recordMysteryGuess(previous, sql, feedback) } : previous);
          } else if (context.kind === "random-mystery") {
            setRandomMysteryRound(previous => previous && previous.targetId === context.targetId && randomRewardId(previous) === context.rewardId ? recordMysteryGuess(previous, sql, feedback) : previous);
          }
        }
        if (reply.passed && context.kind === "challenge") setCompleted(previous => {
          const next = [...new Set([...previous, context.challengeId])];
          return next;
        });
      }
    } catch (error) {
      setRunState({ status: "error", message: (error as Error).message });
      try { setSchema((await initDb()).schema); } catch { /* Keep the recovery error visible; next run retries. */ }
    }
    finally { busyRef.current = false; setBusy(false); }
  }, [ready, pc.award]);

  const run = () => {
    if (view !== "workspace") return;
    if (isMystery) {
      if (!mysteryRound || mysterySolved(mysteryRound)) return;
      const capture = { targetId: mysteryRound.targetId, level: mysteryRound.level ?? legacyEncounterLevel(`mystery:${mysteryRound.targetId}`),
        ball: ballTheme, attempts: mysteryRound.guessCount };
      if (mysteryMode === "daily") {
        if (dailyMysteryRound) void execute(query, { kind: "daily-mystery", ...capture, date: dailyMysteryRound.date,
          rewardId: dailyRewardId(dailyMysteryRound.date, dailyMysteryRound.scheduleVersion) });
      } else { void execute(query, { kind: "random-mystery", ...capture, rewardId: randomRewardId(mysteryRound) }); }
    } else {
      void execute(query, activeChallenge ? { kind: "challenge", challengeId: activeChallenge } : { kind: "practice" });
    }
  };

  const loadSql = (sql: string) => {
    if (busyRef.current) return;
    setView("workspace");
    setSelection(null); editQuery(sql, "sandbox");
    setRunState({ status: "idle", message: "Query loaded. Press Run when you are ready." });
  };
  const handleReset = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const reply = await resetDb();
      setSchema(reply.schema); setNotice(reply.notice);
      if (!reply.error) setDatasetUpdateAvailable(false);
      setRunState(reply.error ? { status: "error", message: reply.error } : { status: "idle", message: "Database restored. Your SQL, saved queries, and challenge progress are still here." });
    } catch (error) { setRunState({ status: "error", message: (error as Error).message }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const handleNewMystery = async () => {
    if (!ready || busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice(undefined);
    try {
      const reply = await startMystery(randomMysteryRound?.targetId);
      setSchema(reply.schema);
      if (reply.error || reply.mysteryTargetId === undefined) throw new Error(reply.error ?? "Could not start a mystery. Try New Pokémon again.");
      const id = crypto.randomUUID();
      setRandomMysteryRound({ id, targetId: reply.mysteryTargetId,
        level: encounterLevel(id, trainerAgeDays(trainerIdentity.issuedAt)), guessCount: 0, attempts: [] });
      setDrafts(previous => ({ ...previous, mystery: MYSTERY_INITIAL_QUERY }));
      setRunState({ status: "idle", message: "A Pokémon is hiding. Start with a guess, then follow the clues." });
    } catch (error) { setRunState({ status: "error", message: (error as Error).message }); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const openDailyMystery = () => {
    if (!ready || busyRef.current) return;
    setView("workspace");
    const now = new Date();
    const date = utcDateKey(now);
    setSelection({ kind: "mystery" }); setMysteryMode("daily"); setNotice(undefined);
    if (dailyMysteryRound?.date !== date) {
      setDailyMysteryRound(createDailyMysteryRound(date, trainerAgeDays(trainerIdentity.issuedAt, now.getTime())));
      setDrafts(previous => ({ ...previous, "mystery-daily": MYSTERY_INITIAL_QUERY }));
    }
    setRunState({ status: "idle", message: "Today's Pokémon is the same for everyone. Submit a SQL guess and follow the clues." });
  };

  const openRandomMystery = () => {
    if (!ready || busyRef.current) return;
    setView("workspace");
    setSelection({ kind: "mystery" }); setMysteryMode("random"); setNotice(undefined);
    setRunState({ status: "idle", message: "Random practice resumes your current round. Choose New Pokémon for a different target." });
    if (!randomMysteryRound) void handleNewMystery();
  };

  const openPokedex = () => {
    if (!busyRef.current) { setPokedexView("collection"); setView("pokedex"); }
  };

  const selectSample = (id: string) => {
    if (busyRef.current) return;
    setView("workspace");
    setSelection({ kind: "sample", id }); setNotice(undefined);
    setRunState({ status: "idle", message: "Try the prompt above, reveal a hint, or explore a worked answer. Press Run when you are ready." });
  };
  const selectChallenge = (id: string | null) => {
    if (busyRef.current) return;
    setView("workspace"); setSelection(id ? { kind: "challenge", id } : null); setNotice(undefined);
    setRunState({ status: "idle", message: id ? "Write your answer above, then check it. Column aliases may differ; return columns in the requested order." : "Free practice uses your saved database." });
  };
  const loadGuideSql = (sql: string) => {
    if (busyRef.current) return;
    if (safariContext) {
      if (safari.phase === "battle") { setView("safari"); safari.actions.editDraft(sql); } else loadSql(sql);
      return;
    }
    setView("workspace"); editQuery(sql); setNotice(undefined);
    setRunState({ status: "idle", message: "SQL guide example loaded into your current editor. Submit it when you are ready." });
  };
  const previewSql = (sql: string) => {
    if (busyRef.current) return;
    if (safariContext) {
      if (safari.phase === "battle") { setView("safari"); safari.actions.editDraft(sql); } else loadSql(sql);
      return;
    }
    setView("workspace");
    if (practice || isMystery) {
      editQuery(sql);
      setRunState({ status: "idle", message: isMystery ? "Query loaded. Narrow it to one Pokémon to make a guess." : challenge ? "Query loaded into your answer. Check it against the original database when you are ready." : "Query loaded. Press Run when you are ready." });
    } else { loadSql(sql); void execute(sql, { kind: "practice" }); }
  };
  const loadAnswer = (sql: string) => {
    if (busyRef.current) return;
    editQuery(sql);
    setRunState({ status: "idle", message: challenge ? "Answer loaded. Check it when you are ready." : "Answer loaded. Press Run when you are ready." });
  };
  const leaveMystery = () => {
    if (busyRef.current) return;
    setSelection(null); setNotice(undefined);
    setRunState({ status: "idle", message: "Free practice uses your saved database. Your current mystery is waiting in Who’s That Pokémon?" });
  };
  const leavePractice = () => {
    if (busyRef.current) return;
    setSelection(null); setRunState({ status: "idle", message: "Free practice uses your saved database." });
  };
  const deleteSaved = (id: string) => {
    const next = saved.filter(item => item.id !== id); setSaved(next); persist("saved", next);
  };
  const clearHistory = () => { setHistory([]); persist("history", []); };
  const changeTheme = (theme: string) => {
    setBallTheme(theme);
    if (!writeLocal("ball-theme", theme)) setProfileSaveError(true);
  };
  const changeAutocomplete = (enabled: boolean) => {
    setAutocomplete(enabled);
    if (!writeLocal("autocomplete", enabled)) setProfileSaveError(true);
  };
  const changeTrainer = (id: TrainerId) => {
    setTrainer(id);
    if (!writeLocal("trainer", id)) setProfileSaveError(true);
  };
  const changeTrainerName = (name: string) => {
    const value = name.slice(0, MAX_TRAINER_NAME);
    setTrainerName(value);
    if (!writeLocal("trainer-name", value)) setProfileSaveError(true);
  };
  const changeSafariFleeAfter = (limit: SafariFleeLimit) => {
    setSafariFleeAfter(limit);
    if (!writeLocal("safari-flee-after", limit)) setProfileSaveError(true);
  };
  const openPersonalization = (next: "profiles" | "settings") => {
    if (busyRef.current) return;
    if (view !== "profiles" && view !== "settings") personalizationReturn.current = view;
    setView(next);
  };
  const navigate = (destination: NavigationId) => {
    if (busyRef.current) return;
    if (destination === "profiles" || destination === "settings") { openPersonalization(destination); return; }
    if (destination === "mystery") { openDailyMystery(); return; }
    if (destination === "pokedex") { openPokedex(); return; }
    if (destination === "workspace") { if (selection) selectChallenge(null); else setView("workspace"); return; }
    const origin = showPersonalization ? personalizationReturn.current : view;
    if (destination === "schema" && origin !== "schema") referenceContext.current = origin === "safari" ? "safari" : "workspace";
    setView(destination);
  };

  return {
    ready, loadError, selection, isMystery, challenge, practice, pc, showPc: view === "pc", showBag: view === "bag",
    query, draftKey, drafts, editorSchema, showWorkspace, activeNavigation, catalogKind, catalogFilters, libraryView, completedCount, challengeCount: CHALLENGES.length, showPokedex, showSafari, showProfiles, showSettings, pokedexView, safari, encounters, seenIds, seenSaveError, achievementCatalog, encounterSaveError, encountersRecovered,
    datasetUpdateAvailable, busy, notice, storageError, offlineStatus, ballTheme, trainer, trainerName, trainerIdentity, autocomplete, safariFleeAfter,
    profileProgress: { entries: encounters.length, species: achievementCatalog?.speciesCount ?? POKEDEX_SPECIES_COUNT, catches: safari.session.catches,
      challenges: completedCount, challengeTotal: CHALLENGES.length,
      types: new Set(encounters.flatMap(entry => [entry.pokemon.type1, entry.pokemon.type2].filter((type): type is string => type !== null))).size,
      typeTotal: achievementCatalog?.types.length ?? 18 },
    profileSaveError, mysteryRound, mysteryMode, dailyMysteryRound, today, completed, history,
    saved, runState,
    actions: {
      run, stop: cancelQuery, reset: handleReset, newMystery: handleNewMystery,
      editQuery: onEditorChange, changeTheme, changeTrainer, changeTrainerName, changeAutocomplete, changeSafariFleeAfter, setPokedexView,
      openProfiles: () => openPersonalization("profiles"), openSettings: () => openPersonalization("settings"),
      navigate, setCatalogFilters: (kind: CatalogKind, filters: CatalogFilters) => setCatalogFilters(previous => ({ ...previous, [kind]: filters })),
      closePersonalization: () => { if (!busyRef.current) setView(personalizationReturn.current); },
      openPokedex, openSafari: () => { if (!busyRef.current) setView("safari"); },
      returnToWorkspace: () => { if (!busyRef.current) setView("workspace"); }, openDailyMystery, openRandomMystery,
      selectSample, selectChallenge, loadSql, loadGuideSql, previewSql, loadAnswer, leaveMystery,
      leavePractice, deleteSaved, clearHistory,
    },
  };
}
