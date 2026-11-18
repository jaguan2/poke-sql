import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { cancelQuery, checkChallenge, initDb, queryMystery, resetDb, runQuery, schemaForAutocomplete, startMystery } from "./db";
import type { QueryResult, TableInfo } from "./db";
import type { AchievementCatalog } from "./types";
import { QueryResults } from "./components/QueryResults";
import { Sidebar } from "./components/Sidebar";
import { Settings } from "./components/Settings";
import { QueryHelp } from "./components/QueryHelp";
import { MusicPlayer } from "./components/MusicPlayer";
import { MysteryNotebook, MysteryPanel } from "./components/PokemonMystery";
import { isMysteryRound, MYSTERY_INITIAL_QUERY, mysterySolved, recordMysteryGuess } from "./mystery";
import type { MysteryRound } from "./mystery";
import { createDailyMysteryRound, isDailyMysteryRound, utcDateKey } from "./daily-mystery";
import type { DailyMysteryRound } from "./daily-mystery";
import { useUtcDay } from "./use-utc-day";
import { useEncounters } from "./use-encounters";
import { PersonalPokedex } from "./components/PersonalPokedex";
import type { SavedQuery } from "./components/Sidebar";
import { CHALLENGES } from "./challenges";
import { SAMPLE_QUERIES } from "./samples";
import { isStringArray, readLocal, writeLocal } from "./storage";
import { prepareOffline } from "./offline";
import { sqlPhraseCompletion } from "./sql-completion";
import ballThemes from "./ball-themes.json";
import "./App.css";
import "./themes.css";

const INITIAL_QUERY = "SELECT * FROM pokedex LIMIT 15;";
const isBallTheme = (value: unknown): value is string => typeof value === "string" && ballThemes.some(theme => theme.id === value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isDrafts = (v: unknown): v is Record<string, string> => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(x => typeof x === "string");
const isSaved = (v: unknown): v is SavedQuery[] => Array.isArray(v) && v.every(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.sql === "string");
type RunState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "ok"; results: QueryResult[]; ms: number; passed?: boolean; mysteryGuess?: boolean };

type PracticeSelection = { kind: "challenge" | "sample"; id: string } | { kind: "mystery" } | null;
type QueryContext =
  | { kind: "practice" }
  | { kind: "challenge"; challengeId: string }
  | { kind: "random-mystery"; targetId: number }
  | { kind: "daily-mystery"; targetId: number; date: string };

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(() => readLocal("drafts", { sandbox: INITIAL_QUERY }, isDrafts));
  const [selection, setSelection] = useState<PracticeSelection>(null);
  const [randomMysteryRound, setRandomMysteryRound] = useState<MysteryRound | null>(() => readLocal("mystery-round", null, isMysteryRound));
  const [dailyMysteryRound, setDailyMysteryRound] = useState<DailyMysteryRound | null>(() => readLocal("daily-mystery-round", null, isDailyMysteryRound));
  const [showPokedex, setShowPokedex] = useState(false);
  const { encounters, saveError: encounterSaveError } = useEncounters(dailyMysteryRound, randomMysteryRound);
  const [mysteryMode, setMysteryMode] = useState<"daily" | "random">("daily");
  const today = useUtcDay();
  const mysteryRound = mysteryMode === "daily" ? dailyMysteryRound : randomMysteryRound;
  const [completed, setCompleted] = useState(() => readLocal("completed", [], isStringArray));
  const [history, setHistory] = useState(() => readLocal("history", [], isStringArray).slice(0, 30));
  const [saved, setSaved] = useState(() => readLocal("saved", [], isSaved));
  const [queryName, setQueryName] = useState("");
  const [runState, setRunState] = useState<RunState>({ status: "idle", message: "Choose a Get started prompt, write your own SQL, or try a challenge. Your work saves on this device." });
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
  const [autocomplete, setAutocomplete] = useState(() => readLocal("autocomplete", true, isBoolean));
  const [settingsSaveError, setSettingsSaveError] = useState(false);
  const activeChallenge = selection?.kind === "challenge" ? selection.id : null;
  const isMystery = selection?.kind === "mystery";
  const challenge = CHALLENGES.find(c => c.id === activeChallenge);
  const sample = selection?.kind === "sample" ? SAMPLE_QUERIES.find(s => s.id === selection.id) : undefined;
  const practice = challenge ? { ...challenge, sql: challenge.solution } : sample;
  const editorSchema = challenge || isMystery ? challengeSchema : schema;
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
  const editorSetup = useMemo(() => ({ autocompletion: autocomplete, completionKeymap: autocomplete, foldGutter: false }), [autocomplete]);

  useEffect(() => { persist("drafts", drafts); }, [drafts, persist]);
  useEffect(() => { persist("history", history); }, [history, persist]);
  useEffect(() => { persist("completed", completed); }, [completed, persist]);
  useEffect(() => { persist("mystery-round", randomMysteryRound); }, [randomMysteryRound, persist]);
  useEffect(() => { persist("daily-mystery-round", dailyMysteryRound); }, [dailyMysteryRound, persist]);

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
          if (context.kind === "daily-mystery") {
            setDailyMysteryRound(previous => previous && previous.date === context.date && previous.targetId === context.targetId
              ? { ...previous, ...recordMysteryGuess(previous, sql, feedback) } : previous);
          } else if (context.kind === "random-mystery") {
            setRandomMysteryRound(previous => previous && previous.targetId === context.targetId ? recordMysteryGuess(previous, sql, feedback) : previous);
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
  }, [ready]);

  const executeRef = useRef(() => {});
  executeRef.current = () => {
    if (showPokedex) return;
    if (isMystery) {
      if (!mysteryRound || mysterySolved(mysteryRound)) return;
      if (mysteryMode === "daily") {
        if (dailyMysteryRound) void execute(query, { kind: "daily-mystery", targetId: dailyMysteryRound.targetId, date: dailyMysteryRound.date });
      } else { void execute(query, { kind: "random-mystery", targetId: mysteryRound.targetId }); }
    } else {
      void execute(query, activeChallenge ? { kind: "challenge", challengeId: activeChallenge } : { kind: "practice" });
    }
  };
  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    sqlLang({ dialect: SQLite, schema: schemaForAutocomplete(editorSchema), upperCaseKeywords: true }),
    sqlPhraseCompletion,
    Prec.highest(keymap.of([{ key: "Ctrl-Enter", mac: "Cmd-Enter", run: () => { executeRef.current(); return true; } }])),
  ], [editorSchema]);

  const loadSql = (sql: string) => {
    if (busyRef.current) return;
    setShowPokedex(false);
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
  const saveQuery = () => {
    if (!query.trim() || !queryName.trim()) return;
    const next = [{ id: crypto.randomUUID(), name: queryName.trim(), sql: query }, ...saved];
    setSaved(next); const stored = persist("saved", next); setQueryName("");
    setNotice(stored ? "Query saved. Find it in the Saved tab." : "Query kept for this session only. This device could not save it.");
  };

  const handleNewMystery = async () => {
    if (!ready || busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice(undefined);
    try {
      const reply = await startMystery(randomMysteryRound?.targetId);
      setSchema(reply.schema);
      if (reply.error || reply.mysteryTargetId === undefined) throw new Error(reply.error ?? "Could not start a mystery. Try New Pokémon again.");
      setRandomMysteryRound({ targetId: reply.mysteryTargetId, guessCount: 0, attempts: [] });
      setDrafts(previous => ({ ...previous, mystery: MYSTERY_INITIAL_QUERY }));
      setRunState({ status: "idle", message: "A Pokémon is hiding. Start with a guess, then follow the clues." });
    } catch (error) { setRunState({ status: "error", message: (error as Error).message }); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const openDailyMystery = () => {
    if (!ready || busyRef.current) return;
    setShowPokedex(false);
    const date = utcDateKey();
    setSelection({ kind: "mystery" }); setMysteryMode("daily"); setNotice(undefined);
    if (dailyMysteryRound?.date !== date) {
      setDailyMysteryRound(createDailyMysteryRound(date));
      setDrafts(previous => ({ ...previous, "mystery-daily": MYSTERY_INITIAL_QUERY }));
    }
    setRunState({ status: "idle", message: "Today's Pokémon is the same for everyone. Submit a SQL guess and follow the clues." });
  };

  const openRandomMystery = () => {
    if (!ready || busyRef.current) return;
    setShowPokedex(false);
    setSelection({ kind: "mystery" }); setMysteryMode("random"); setNotice(undefined);
    setRunState({ status: "idle", message: "Random practice resumes your current round. Choose New Pokémon for a different target." });
    if (!randomMysteryRound) void handleNewMystery();
  };

  const openPokedex = () => {
    if (!busyRef.current) setShowPokedex(true);
  };

  if (loadError) return <div className="load-screen"><h1>Could not load PokéSQL</h1><p>{loadError}</p><button className="btn" onClick={() => location.reload()}>Try again</button></div>;
  if (!ready) return <div className="load-screen"><img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={64} height={64} className="spin" /><p>Loading your Pokédex…</p></div>;

  return <div className="app">
    <header className="header">
      <div className="brand">
        <div className="dex-lights" aria-hidden="true"><span className="dex-lens" /><span className="dex-light" /><span className="dex-light" /></div>
        <div><h1>Poké<span className="brand-accent">SQL</span></h1><span className="tagline">Your pocket SQL laboratory</span></div>
      </div>
      <Settings ballTheme={ballTheme} autocomplete={autocomplete} saveError={settingsSaveError}
        onThemeChange={theme => {
          setBallTheme(theme);
          if (!writeLocal("ball-theme", theme)) setSettingsSaveError(true);
        }}
        onAutocompleteChange={enabled => {
          setAutocomplete(enabled);
          if (!writeLocal("autocomplete", enabled)) setSettingsSaveError(true);
        }} />
      <div className="header-actions">
        {showPokedex ? <>
          <button className="btn btn-secondary" onClick={() => setShowPokedex(false)}>Back to workspace</button>
          <button className="btn btn-primary" onClick={openDailyMystery}>Today's mystery</button>
        </> : <>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void handleReset()} title="Restore the original database; keeps saved SQL and progress">Reset DB</button>
        {busy ? <button className="btn btn-primary" onClick={() => cancelQuery()}>■ Stop query</button> : <button className="btn btn-primary" disabled={!query.trim() || (isMystery && (!mysteryRound || mysterySolved(mysteryRound)))} onClick={() => executeRef.current()}>{isMystery ? "Guess Pokémon" : challenge ? "Check answer" : "▶ Run"} <kbd>Ctrl+Enter</kbd></button>}
        </>}
      </div>
    </header>
    <div className="body">
      <Sidebar schema={editorSchema} busy={busy} history={history} saved={saved} completed={completed} activeChallenge={activeChallenge} activeSample={sample?.id ?? null} activeMystery={isMystery && !showPokedex}
        pokedexCount={encounters.length} activePokedex={showPokedex} onPokedex={openPokedex}
        onMystery={openDailyMystery}
        onSample={id => {
          setShowPokedex(false);
          setSelection({ kind: "sample", id }); setNotice(undefined);
          setRunState({ status: "idle", message: "Try the prompt above, reveal a hint, or explore a worked answer. Press Run when you are ready." });
        }} onLoadSql={loadSql}
        onGuideSql={sql => {
          if (busyRef.current) return;
          setShowPokedex(false);
          editQuery(sql); setNotice(undefined);
          setRunState({ status: "idle", message: "SQL guide example loaded into your current editor. Submit it when you are ready." });
        }}
        onPreviewSql={sql => {
          if (busyRef.current) return;
          setShowPokedex(false);
          if (practice || isMystery) {
            editQuery(sql);
            setRunState({ status: "idle", message: isMystery ? "Query loaded. Narrow it to one Pokémon to make a guess." : challenge ? "Query loaded into your answer. Check it against the original database when you are ready." : "Query loaded. Press Run when you are ready." });
          } else { loadSql(sql); void execute(sql, { kind: "practice" }); }
        }}
        onChallenge={id => { setShowPokedex(false); setSelection(id ? { kind: "challenge", id } : null); setNotice(undefined); setRunState({ status: "idle", message: id ? "Write your answer above, then check it. Column aliases may differ; return columns in the requested order." : "Free practice uses your saved database." }); }}
        onDeleteSaved={id => { const next = saved.filter(item => item.id !== id); setSaved(next); persist("saved", next); }}
        onClearHistory={() => { setHistory([]); persist("history", []); }} />
      <main className={`main${isMystery && !showPokedex ? " mystery-workspace" : ""}`}>
        {showPokedex ? <PersonalPokedex encounters={encounters} catalog={achievementCatalog} saveError={encounterSaveError} onDaily={openDailyMystery} onRandom={openRandomMystery} /> : <>
        {datasetUpdateAvailable && !isMystery && !challenge && <div className="notice dataset-update" role="status">
          <strong>New Pokédex fields and forms are available.</strong> Your saved practice database is an older version. Reset DB loads the update and replaces practice database edits. Your SQL drafts, saved queries, and progress stay saved.
          <button className="btn" disabled={busy} onClick={() => void handleReset()}>Reset DB and load update</button>
        </div>}
        {isMystery && <MysteryPanel round={mysteryRound} busy={busy} mode={mysteryMode} date={dailyMysteryRound?.date} today={today}
          onDaily={openDailyMystery} onRandom={openRandomMystery} onNew={() => void handleNewMystery()}
          onLeave={() => { setSelection(null); setNotice(undefined); setRunState({ status: "idle", message: "Free practice uses your saved database. Your current mystery is waiting in Who’s That Pokémon?" }); }} />}
        {practice && <section className="practice-panel" key={`${selection?.kind}:${practice.id}`} aria-label={challenge ? "Current challenge" : "Get started query"}>
          <div className="challenge-heading"><span className="eyebrow">{challenge?.topic ?? "Get started"}</span><button className="sample-btn" disabled={busy} onClick={() => { setSelection(null); setRunState({ status: "idle", message: "Free practice uses your saved database." }); }}>Back to free practice</button></div>
          <h2>{practice.title}</h2><p>{practice.prompt}</p>
          <QueryHelp hint={practice.hint} hintSql={practice.hintSql} answer={practice.sql} alternatives={practice.alternatives} busy={busy} onUseAnswer={sql => {
            editQuery(sql); setRunState({ status: "idle", message: challenge ? "Answer loaded. Check it when you are ready." : "Answer loaded. Press Run when you are ready." });
          }} />
          <small>{challenge ? "Answers run against the original Pokédex. Your practice database stays separate." : "These examples use your practice database. Reset DB if you want to restore the original data."}</small>
        </section>}
        <form className="editor-toolbar" onSubmit={event => { event.preventDefault(); saveQuery(); }}>
          <span className="editor-label">{isMystery ? "Your next guess" : practice ? "Your answer" : "Free practice"}</span>
          <label className="sr-only" htmlFor="query-name">Query name</label><input id="query-name" value={queryName} onChange={event => setQueryName(event.target.value)} placeholder="Name this query…" maxLength={80} />
          <button className="btn" disabled={!queryName.trim() || !query.trim()}>Save query</button>
        </form>
        {/* Each draft owns its editor instance. A delayed controlled-value
            update from the previous mode must not overwrite a new edit. */}
        <div className="editor-wrap"><CodeMirror key={draftKey} className="sql-editor" value={query} onChange={onEditorChange} extensions={extensions} editable={!busy} theme="dark" height="100%" aria-label="SQL editor" basicSetup={editorSetup} /></div>
        <div className="results" aria-busy={busy}>
          <h2 className="results-heading">{isMystery ? "Mystery notebook" : "Query results"}</h2>
          {isMystery && mysteryRound && <MysteryNotebook round={mysteryRound} daily={mysteryMode === "daily"} onOpenPokedex={openPokedex} />}
          {(storageError || encounterSaveError) && <p className="notice" role="status">This device could not save your SQL or progress. Keep a copy before closing.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          {busy ? <p className="running-notice" role="status">Running SQL… You can stop it at any time. Queries time out after 8 seconds.</p> : <>
            {runState.status === "idle" && (isMystery ? <p className="mystery-idle">{runState.message}</p> : <div className="empty-state">
              <div className="starter-sprites" aria-hidden="true">{[1, 4, 7].map(id => <img key={id} src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt="" width={72} height={72} />)}</div>
              <h2>A little curiosity. A whole Pokédex.</h2><p>{runState.message}</p>
            </div>)}
            {runState.status === "error" && <div className="error-panel" role="alert"><strong>SQL message:</strong> {runState.message}</div>}
            {runState.status === "ok" && <>
              {runState.passed !== undefined && <div className={runState.passed ? "reset-notice" : "notice"} role="status">{runState.passed ? "✓ Correct! Challenge completed." : "Not quite yet. Check the requested columns, filters, duplicates, and row order, then try again."}</div>}
              <div className="status-bar">{runState.results.length === 0 ? "Statement executed — no rows returned." : `${runState.results.reduce((n, r) => n + r.values.length, 0).toLocaleString()}${runState.results.some(r => r.truncated) ? "+" : ""} row(s) in ${runState.ms.toFixed(1)} ms`}</div>
              {isMystery && runState.mysteryGuess ? <details className="mystery-query-results"><summary>Latest query results</summary><QueryResults results={runState.results} /></details> : <QueryResults results={runState.results} />}
            </>}
          </>}
        </div>
        </>}
        <MusicPlayer />
        <footer className="workspace-status"><span>SQLite · stored on this device</span><span role="status">{offlineStatus}</span></footer>
      </main>
    </div>
  </div>;
}
