import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { MAX_RESULT_ROWS, getSchema, initDb, resetDb, runQuery, schemaForAutocomplete } from "./db";
import type { QueryResult, TableInfo } from "./db";
import { ResultsTable } from "./components/ResultsTable";
import { Sidebar } from "./components/Sidebar";
import "./App.css";

const INITIAL_QUERY = "SELECT * FROM pokedex LIMIT 15;";

type RunState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "reset" }
  | { status: "ok"; results: QueryResult[]; ms: number };

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [runState, setRunState] = useState<RunState>({ status: "loading" });
  const [schema, setSchema] = useState<TableInfo[]>([]);

  const execute = useCallback((sql: string) => {
    const trimmed = sql.trim();
    if (!trimmed) return;
    try {
      const t0 = performance.now();
      const results = runQuery(trimmed);
      const ms = performance.now() - t0;
      setRunState({ status: "ok", results, ms });
      setSchema(getSchema()); // picks up CREATE/DROP TABLE practice
    } catch (e) {
      setRunState({ status: "error", message: (e as Error).message });
    }
  }, []);

  // Keep the CodeMirror keybinding pointed at the latest query text.
  const executeRef = useRef<() => void>(() => {});
  executeRef.current = () => execute(query);

  useEffect(() => {
    initDb()
      .then(() => {
        setSchema(getSchema());
        setReady(true);
        execute(INITIAL_QUERY);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [execute]);

  const extensions = useMemo(
    () => [
      sqlLang({ schema: schemaForAutocomplete(schema), upperCaseKeywords: true }),
      Prec.highest(
        keymap.of([
          {
            key: "Ctrl-Enter",
            mac: "Cmd-Enter",
            run: () => {
              executeRef.current();
              return true;
            },
          },
        ])
      ),
    ],
    [schema]
  );

  const runFromSidebar = useCallback(
    (sql: string) => {
      setQuery(sql);
      execute(sql);
    },
    [execute]
  );

  // Deliberately does NOT re-run the editor content: it may contain the very
  // UPDATE/DROP the user is resetting away from.
  const handleReset = useCallback(() => {
    resetDb();
    setSchema(getSchema());
    setRunState({ status: "reset" });
  }, []);

  if (loadError) {
    return (
      <div className="load-screen">
        <p>Failed to load the Pokédex database: {loadError}</p>
        <p>
          Run <code>py scripts/build_db.py</code> from the repo root, then refresh.
        </p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="load-screen">
        <img
          src={`${import.meta.env.BASE_URL}pokeball.svg`}
          alt=""
          width={64}
          height={64}
          className="spin"
        />
        <p>Loading Pokédex…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={28} height={28} />
          <h1>
            Poké<span className="brand-accent">SQL</span>
          </h1>
          <span className="tagline">SQL practice, Pokédex edition</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleReset} title="Restore the original database">
            Reset DB
          </button>
          <button className="btn btn-primary" onClick={() => execute(query)}>
            ▶ Run <kbd>Ctrl+Enter</kbd>
          </button>
        </div>
      </header>

      <div className="body">
        <Sidebar schema={schema} onRunSql={runFromSidebar} />

        <main className="main">
          <div className="editor-wrap">
            <CodeMirror
              value={query}
              onChange={setQuery}
              extensions={extensions}
              theme="dark"
              height="100%"
              basicSetup={{ autocompletion: true, foldGutter: false }}
            />
          </div>

          <div className="results">
            {runState.status === "error" && (
              <div className="error-panel">
                <strong>SQL error:</strong> {runState.message}
              </div>
            )}
            {runState.status === "reset" && (
              <div className="reset-notice">
                Database restored to its original state. Your SQL is still in
                the editor — press Run to execute it.
              </div>
            )}
            {runState.status === "ok" && (
              <>
                <div className="status-bar">
                  {runState.results.length === 0
                    ? "Statement executed — no rows returned."
                    : `${runState.results
                        .reduce((n, r) => n + r.values.length, 0)
                        .toLocaleString()}${
                        runState.results.some((r) => r.truncated) ? "+" : ""
                      } row(s) in ${runState.ms.toFixed(1)} ms${
                        runState.results.some((r) => r.truncated)
                          ? ` — stopped at ${MAX_RESULT_ROWS.toLocaleString()} rows per statement; add a LIMIT clause`
                          : ""
                      }`}
                </div>
                {runState.results.map((r, i) => (
                  <ResultsTable key={i} result={r} />
                ))}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
