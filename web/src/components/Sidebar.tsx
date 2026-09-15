import type { TableInfo } from "../db";
import { SAMPLE_QUERIES } from "../samples";
import { CHALLENGES } from "../challenges";
import { useState } from "react";

export interface SavedQuery { id: string; name: string; sql: string }

interface SidebarProps {
  schema: TableInfo[];
  onRunSql: (sql: string) => void;
  onLoadSql: (sql: string) => void;
  onChallenge: (id: string | null) => void;
  completed: string[];
  activeChallenge: string | null;
  history: string[];
  saved: SavedQuery[];
  onDeleteSaved: (id: string) => void;
  onClearHistory: () => void;
  busy: boolean;
}

export function Sidebar({ schema, onRunSql, onLoadSql, onChallenge, completed, activeChallenge, history, saved, onDeleteSaved, onClearHistory, busy }: SidebarProps) {
  const [tab, setTab] = useState("Explore");
  return (
    <aside className="sidebar">
      <nav className="sidebar-tabs" aria-label="Practice tools">
        {["Explore", "Challenges", "History", "Saved"].map(name => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)} aria-pressed={tab === name}>{name}</button>)}
      </nav>
      {tab === "Explore" &&
      <section>
        <h2>Sample queries</h2>
        <ul className="sample-list">
          {SAMPLE_QUERIES.map((q) => (
            <li key={q.title}>
              <button className="sample-btn" disabled={busy} onClick={() => onRunSql(q.sql)}>
                {q.title}
              </button>
            </li>
          ))}
        </ul>
      </section>
      }
      {tab === "Challenges" && <section>
        <h2>Training · {completed.filter(id => CHALLENGES.some(c => c.id === id)).length}/{CHALLENGES.length} complete</h2>
        <button className="sample-btn" disabled={busy} onClick={() => onChallenge(null)}>← Free practice</button>
        {CHALLENGES.map((challenge, index) => <button key={challenge.id} disabled={busy} className={`challenge-link ${activeChallenge === challenge.id ? "selected" : ""}`} onClick={() => onChallenge(challenge.id)}>
          <span>{completed.includes(challenge.id) ? "✓" : index + 1}. {challenge.title}</span><small>{challenge.topic}</small>
        </button>)}
      </section>}
      {tab === "History" && <section>
        <h2>Last 30 runs</h2>
        <p className="sidebar-note">Select a query to load it into free practice.</p>
        {history.length === 0 && <p className="sidebar-note">Your executed SQL will appear here.</p>}
        {history.map((sql, i) => <button key={i} disabled={busy} className="history-query" title={sql} onClick={() => onLoadSql(sql)}>{sql}</button>)}
        {history.length > 0 && <button className="sample-btn" onClick={onClearHistory}>Clear history</button>}
      </section>}
      {tab === "Saved" && <section>
        <h2>Saved queries</h2>
        {saved.length === 0 && <p className="sidebar-note">Give your SQL a name above the editor, then save it here.</p>}
        {saved.map(item => <div className="saved-query" key={item.id}>
          <button className="sample-btn" disabled={busy} onClick={() => onLoadSql(item.sql)}>{item.name}</button>
          <button className="remove-query" aria-label={`Delete ${item.name}`} onClick={() => onDeleteSaved(item.id)}>×</button>
        </div>)}
      </section>}

      <section>
        <h2>Schema</h2>
        {schema.map((t) => (
          <details key={t.name} open={t.kind === "view"}>
            {/* summary only toggles; the query action lives outside it so
                interactive elements are never nested */}
            <summary>
              <span className="table-name">{t.name}</span>
              <span className="table-kind">{t.kind}</span>
            </summary>
            <button
              className="preview-btn"
              disabled={busy}
              onClick={() => onRunSql(`SELECT * FROM "${t.name.replace(/"/g, '""')}" LIMIT 25;`)}
            >
              ▶ SELECT * FROM {t.name}
            </button>
            <ul className="column-list">
              {t.columns.map((c) => (
                <li key={c.name}>
                  <span className="col-name">
                    {c.name}
                    {c.pk ? " 🔑" : ""}
                  </span>
                  <span className="col-type">{c.type.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </aside>
  );
}
