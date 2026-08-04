import type { TableInfo } from "../db";
import { SAMPLE_QUERIES } from "../samples";

interface SidebarProps {
  schema: TableInfo[];
  onRunSql: (sql: string) => void;
}

export function Sidebar({ schema, onRunSql }: SidebarProps) {
  return (
    <aside className="sidebar">
      <section>
        <h2>Sample queries</h2>
        <ul className="sample-list">
          {SAMPLE_QUERIES.map((q) => (
            <li key={q.title}>
              <button className="sample-btn" onClick={() => onRunSql(q.sql)}>
                {q.title}
              </button>
            </li>
          ))}
        </ul>
      </section>

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
              onClick={() => onRunSql(`SELECT * FROM ${t.name} LIMIT 25;`)}
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
