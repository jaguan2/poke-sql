import { useState } from "react";
import type { TableInfo } from "../../shared/sql/types";
import "./SchemaBrowser.css";

export function SchemaBrowser({ schema, title, busy, onPreviewSql }: {
  schema: TableInfo[]; title: string; busy: boolean; onPreviewSql: (sql: string) => void;
}) {
  const [selectedName, setSelectedName] = useState("pokedex");
  const selected = schema.find(table => table.name === selectedName) ?? schema[0];
  return <section className="schema-browser" aria-labelledby="schema-browser-title">
    <h3 id="schema-browser-title" tabIndex={-1}>{title}</h3>
    {selected ? <div className="schema-layout">
      <div className="schema-tables" role="group" aria-label="Tables and views">
        {schema.map(table => <button key={table.name} className="schema-table" aria-pressed={table.name === selected.name}
          onClick={() => setSelectedName(table.name)}>
          <span className="table-name">{table.name}</span><span className="table-kind">{table.kind}</span>
        </button>)}
      </div>
      <section className="schema-columns" aria-labelledby="schema-columns-title">
        <header><h4 id="schema-columns-title">{selected.name}</h4><span>{selected.columns.length} columns · {selected.kind}</span></header>
        <button className="preview-btn" disabled={busy} title="Load or preview this table in your current editor"
          onClick={() => onPreviewSql(`SELECT * FROM "${selected.name.replace(/"/g, '""')}" LIMIT 25;`)}>▶ SELECT * FROM {selected.name}</button>
        {selected.columns.length > 0 ? <ul className="column-list" tabIndex={0} aria-label={`${selected.name} columns`}>
          {selected.columns.map(column => <li key={column.name}><span className="col-name">{column.name}{column.pk ? " 🔑" : ""}</span><span className="col-type">{column.type.toLowerCase()}</span></li>)}
        </ul> : <p className="schema-unavailable">Columns are unavailable. Check whether this view references a table you removed.</p>}
      </section>
    </div> : <p className="library-empty">No tables or views remain. Reset DB to restore the original database.</p>}
  </section>;
}
