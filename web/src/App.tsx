import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { cancelQuery, checkChallenge, initDb, resetDb, runQuery, schemaForAutocomplete } from "./db";
import type { QueryResult, TableInfo } from "./db";
import { QueryResults } from "./components/QueryResults";
import { Sidebar } from "./components/Sidebar";
import { Settings } from "./components/Settings";
import { QueryHelp } from "./components/QueryHelp";
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
  | { status: "ok"; results: QueryResult[]; ms: number; passed?: boolean };

type PracticeSelection = { kind: "challenge" | "sample"; id: string } | null;

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(() => readLocal("drafts", { sandbox: INITIAL_QUERY }, isDrafts));
  const [selection, setSelection] = useState<PracticeSelection>(null);
  const [completed, setCompleted] = useState(() => readLocal("completed", [], isStringArray));
  const [history, setHistory] = useState(() => readLocal("history", [], isStringArray).slice(0, 30));
  const [saved, setSaved] = useState(() => readLocal("saved", [], isSaved));
  const [queryName, setQueryName] = useState("");
  const [runState, setRunState] = useState<RunState>({ status: "idle", message: "Choose a Get started prompt, write your own SQL, or try a challenge. Your work saves on this device." });
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [challengeSchema, setChallengeSchema] = useState<TableInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [storageError, setStorageError] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState("");
  const [ballTheme, setBallTheme] = useState(() => readLocal("ball-theme", "poke-ball", isBallTheme));
  const [autocomplete, setAutocomplete] = useState(() => readLocal("autocomplete", true, isBoolean));
  const [settingsSaveError, setSettingsSaveError] = useState(false);
  const activeChallenge = selection?.kind === "challenge" ? selection.id : null;
  const challenge = CHALLENGES.find(c => c.id === activeChallenge);
  const sample = selection?.kind === "sample" ? SAMPLE_QUERIES.find(s => s.id === selection.id) : undefined;
  const practice = challenge ? { ...challenge, sql: challenge.solution } : sample;
  const editorSchema = challenge ? challengeSchema : schema;
  const draftKey = activeChallenge ?? (sample ? `sample:${sample.id}` : "sandbox");
  const query = drafts[draftKey] ?? (practice ? `-- ${practice.title}\nSELECT ` : INITIAL_QUERY);

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

  useEffect(() => { persist("drafts", drafts); }, [drafts, persist]);
  useEffect(() => { persist("history", history); }, [history, persist]);
  useEffect(() => { persist("completed", completed); }, [completed, persist]);

  useEffect(() => {
    let disposed = false;
    initDb().then(reply => {
      if (disposed) return;
      setSchema(reply.schema); setChallengeSchema(reply.challengeSchema ?? reply.schema); setNotice(reply.notice); setReady(true);
    }).catch(error => { if (!disposed) setLoadError((error as Error).message); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => prepareOffline(setOfflineStatus), []);
  useEffect(() => {
    document.documentElement.dataset.ballTheme = ballTheme;
    return () => { delete document.documentElement.dataset.ballTheme; };
  }, [ballTheme]);

  const execute = useCallback(async (sql: string, challengeId: string | null) => {
    if (!ready || busyRef.current || !sql.trim()) return;
    busyRef.current = true; setBusy(true); setNotice(undefined);
    setHistory(previous => {
      const next = [sql, ...previous.filter(item => item !== sql)].slice(0, 30);
      return next;
    });
    try {
      const reply = challengeId ? await checkChallenge(sql, challengeId) : await runQuery(sql);
      setSchema(reply.schema); setNotice(reply.notice);
      if (reply.error) setRunState({ status: "error", message: reply.error });
      else {
        setRunState({ status: "ok", results: reply.results ?? [], ms: reply.ms ?? 0, passed: reply.passed });
        if (reply.passed && challengeId) setCompleted(previous => {
          const next = [...new Set([...previous, challengeId])];
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
  executeRef.current = () => { void execute(query, activeChallenge); };
  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    sqlLang({ dialect: SQLite, schema: schemaForAutocomplete(editorSchema), upperCaseKeywords: true }),
    sqlPhraseCompletion,
    Prec.highest(keymap.of([{ key: "Ctrl-Enter", mac: "Cmd-Enter", run: () => { executeRef.current(); return true; } }])),
  ], [editorSchema]);

  const loadSql = (sql: string) => {
    if (busyRef.current) return;
    setSelection(null); editQuery(sql, "sandbox");
    setRunState({ status: "idle", message: "Query loaded. Press Run when you are ready." });
  };
  const handleReset = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const reply = await resetDb();
      setSchema(reply.schema); setNotice(reply.notice);
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
        <button className="btn btn-secondary" disabled={busy} onClick={() => void handleReset()} title="Restore the original database; keeps saved SQL and progress">Reset DB</button>
        {busy ? <button className="btn btn-primary" onClick={() => cancelQuery()}>■ Stop query</button> : <button className="btn btn-primary" disabled={!query.trim()} onClick={() => void execute(query, activeChallenge)}>{challenge ? "Check answer" : "▶ Run"} <kbd>Ctrl+Enter</kbd></button>}
      </div>
    </header>
    <div className="body">
      <Sidebar schema={editorSchema} busy={busy} history={history} saved={saved} completed={completed} activeChallenge={activeChallenge} activeSample={sample?.id ?? null}
        onSample={id => {
          setSelection({ kind: "sample", id }); setNotice(undefined);
          setRunState({ status: "idle", message: "Try the prompt above, reveal a hint, or explore a worked answer. Press Run when you are ready." });
        }} onLoadSql={loadSql}
        onPreviewSql={sql => {
          if (busyRef.current) return;
          if (practice) {
            editQuery(sql);
            setRunState({ status: "idle", message: challenge ? "Query loaded into your answer. Check it against the original database when you are ready." : "Query loaded. Press Run when you are ready." });
          } else { loadSql(sql); void execute(sql, null); }
        }}
        onChallenge={id => { setSelection(id ? { kind: "challenge", id } : null); setNotice(undefined); setRunState({ status: "idle", message: id ? "Write your answer above, then check it. Column aliases may differ; return columns in the requested order." : "Free practice uses your saved database." }); }}
        onDeleteSaved={id => { const next = saved.filter(item => item.id !== id); setSaved(next); persist("saved", next); }}
        onClearHistory={() => { setHistory([]); persist("history", []); }} />
      <main className="main">
        {practice && <section className="practice-panel" key={`${selection?.kind}:${practice.id}`} aria-label={challenge ? "Current challenge" : "Get started query"}>
          <div className="challenge-heading"><span className="eyebrow">{challenge?.topic ?? "Get started"}</span><button className="sample-btn" disabled={busy} onClick={() => { setSelection(null); setRunState({ status: "idle", message: "Free practice uses your saved database." }); }}>Back to free practice</button></div>
          <h2>{practice.title}</h2><p>{practice.prompt}</p>
          <QueryHelp hint={practice.hint} hintSql={practice.hintSql} answer={practice.sql} alternatives={practice.alternatives} busy={busy} onUseAnswer={sql => {
            editQuery(sql); setRunState({ status: "idle", message: challenge ? "Answer loaded. Check it when you are ready." : "Answer loaded. Press Run when you are ready." });
          }} />
          <small>{challenge ? "Answers run against the original Pokédex. Your practice database stays separate." : "These examples use your practice database. Reset DB if you want to restore the original data."}</small>
        </section>}
        <form className="editor-toolbar" onSubmit={event => { event.preventDefault(); saveQuery(); }}>
          <span className="editor-label">{practice ? "Your answer" : "Free practice"}</span>
          <label className="sr-only" htmlFor="query-name">Query name</label><input id="query-name" value={queryName} onChange={event => setQueryName(event.target.value)} placeholder="Name this query…" maxLength={80} />
          <button className="btn" disabled={!queryName.trim() || !query.trim()}>Save query</button>
        </form>
        <div className="editor-wrap"><CodeMirror value={query} onChange={value => editQuery(value)} extensions={extensions} editable={!busy} theme="dark" height="100%" aria-label="SQL editor" basicSetup={{ autocompletion: autocomplete, completionKeymap: autocomplete, foldGutter: false }} /></div>
        <div className="results" aria-busy={busy}>
          <h2 className="results-heading">Query results</h2>
          {storageError && <p className="notice" role="status">This device could not save your SQL or progress. Keep a copy before closing.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          {busy ? <p className="running-notice" role="status">Running SQL… You can stop it at any time. Queries time out after 8 seconds.</p> : <>
            {runState.status === "idle" && <div className="empty-state">
              <div className="starter-sprites" aria-hidden="true">{[1, 4, 7].map(id => <img key={id} src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt="" width={72} height={72} />)}</div>
              <h2>A little curiosity. A whole Pokédex.</h2><p>{runState.message}</p>
            </div>}
            {runState.status === "error" && <div className="error-panel" role="alert"><strong>SQL message:</strong> {runState.message}</div>}
            {runState.status === "ok" && <>
              {runState.passed !== undefined && <div className={runState.passed ? "reset-notice" : "notice"} role="status">{runState.passed ? "✓ Correct! Challenge completed." : "Not quite yet. Check the requested columns, filters, duplicates, and row order, then try again."}</div>}
              <div className="status-bar">{runState.results.length === 0 ? "Statement executed — no rows returned." : `${runState.results.reduce((n, r) => n + r.values.length, 0).toLocaleString()}${runState.results.some(r => r.truncated) ? "+" : ""} row(s) in ${runState.ms.toFixed(1)} ms`}</div>
              <QueryResults results={runState.results} />
            </>}
          </>}
        </div>
        <footer className="workspace-status"><span>SQLite · stored on this device</span><span role="status">{offlineStatus}</span></footer>
      </main>
    </div>
  </div>;
}
