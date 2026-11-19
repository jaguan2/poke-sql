import { useEffect, useRef } from "react";
import type { TableInfo } from "../../shared/sql/types";
import { SqlGuide } from "../../features/practice/SqlGuide";
import { SchemaBrowser } from "./SchemaBrowser";
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
    <header><h2 id="library-title" ref={heading} tabIndex={-1}>{view === "schema" ? "Schema & guide" : view === "history" ? "History" : "Saved queries"}</h2><p>{view === "schema" ? "Browse tables and columns or load a SQL example." : view === "history" ? "Your last 30 SQL runs. Select one to load it into free practice." : "Select a saved query to open it in free practice."}</p></header>
    {view === "schema" ? <><nav className="library-reference-links" aria-label="Reference sections"><a href="#schema-browser-title">Tables & views</a><a href="#sql-guide-title">SQL guide ↓</a></nav>
      <SchemaBrowser schema={schema} title={schemaTitle} busy={busy} onPreviewSql={onPreviewSql} /><SqlGuide busy={busy} onUseExample={onGuideSql} /></>
    : view === "history" ? <section><div className="library-section-heading"><h3>Last 30 runs</h3>{history.length > 0 && <button className="btn" onClick={onClearHistory}>Clear history</button>}</div>{history.length === 0 && <p className="library-empty">Your executed SQL will appear here.</p>}{history.map((sql, i) => <button key={i} disabled={busy} className="history-query" title={sql} onClick={() => onLoadSql(sql)}>{sql}</button>)}</section>
    : <section>{saved.length === 0 && <p className="library-empty">Give your SQL a name above the editor, then save it here.</p>}{saved.map(item => <div className="saved-query" key={item.id}><button className="sample-btn" disabled={busy} onClick={() => onLoadSql(item.sql)}>{item.name}</button><button className="remove-query" aria-label={`Delete ${item.name}`} onClick={() => onDeleteSaved(item.id)}>×</button></div>)}</section>}
  </section>;
}
