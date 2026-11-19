import { useEffect, useRef } from "react";
import type { TableInfo } from "../../shared/sql/types";
import { SqlGuide } from "../../features/practice/SqlGuide";
import type { SavedQuery } from "../workspace-types";
import "./WorkspaceLibrary.css";

type LibraryView = "schema" | "history" | "saved";
interface Props {
  view: LibraryView; schema: TableInfo[]; history: string[]; saved: SavedQuery[]; busy: boolean;
  schemaTitle: string; onPreviewSql: (sql: string) => void; onGuideSql: (sql: string) => void;
  onLoadSql: (sql: string) => void; onDeleteSaved: (id: string) => void; onClearHistory: () => void;
}

export function WorkspaceLibrary({ view, schema, history, saved, busy, schemaTitle, onPreviewSql, onGuideSql, onLoadSql, onDeleteSaved, onClearHistory }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  useEffect(() => { page.current?.scrollIntoView({ block: "start" }); heading.current?.focus({ preventScroll: true }); }, [view]);
  return <section className="workspace-library" ref={page} aria-labelledby="library-title">
    <header><span className="eyebrow">Your SQL workspace</span><h2 id="library-title" ref={heading} tabIndex={-1}>{view === "schema" ? "Schema & guide" : view === "history" ? "History" : "Saved queries"}</h2><p>{view === "schema" ? "Explore the tables, then take an example back to your current editor." : view === "history" ? "Your last 30 SQL runs. Select one to load it into free practice." : "Your named SQL queries, ready to revisit in free practice."}</p></header>
    {view === "schema" ? <><section className="schema-browser" aria-label={schemaTitle}><h3>{schemaTitle}</h3><div className="schema-tables">{schema.map(table => <details key={table.name} open={table.kind === "view"}>
      <summary><span className="table-name">{table.name}</span><span className="table-kind">{table.kind}</span></summary>
      <button className="preview-btn" disabled={busy} title="Load or preview this table in your current editor" onClick={() => onPreviewSql(`SELECT * FROM "${table.name.replace(/"/g, '""')}" LIMIT 25;`)}>▶ SELECT * FROM {table.name}</button>
      <ul className="column-list">{table.columns.map(column => <li key={column.name}><span className="col-name">{column.name}{column.pk ? " 🔑" : ""}</span><span className="col-type">{column.type.toLowerCase()}</span></li>)}</ul>
    </details>)}</div></section><SqlGuide busy={busy} onUseExample={onGuideSql} /></>
    : view === "history" ? <section><div className="library-section-heading"><h3>Last 30 runs</h3>{history.length > 0 && <button className="btn" onClick={onClearHistory}>Clear history</button>}</div>{history.length === 0 && <p className="library-empty">Your executed SQL will appear here.</p>}{history.map((sql, i) => <button key={i} disabled={busy} className="history-query" title={sql} onClick={() => onLoadSql(sql)}>{sql}</button>)}</section>
    : <section>{saved.length === 0 && <p className="library-empty">Give your SQL a name above the editor, then save it here.</p>}{saved.map(item => <div className="saved-query" key={item.id}><button className="sample-btn" disabled={busy} onClick={() => onLoadSql(item.sql)}>{item.name}</button><button className="remove-query" aria-label={`Delete ${item.name}`} onClick={() => onDeleteSaved(item.id)}>×</button></div>)}</section>}
  </section>;
}
