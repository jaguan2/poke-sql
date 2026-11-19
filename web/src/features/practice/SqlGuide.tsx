import { SQL_GUIDE_TOPICS } from "./sql-guide";
import "./SqlGuide.css";

export function SqlGuide({ busy, onUseExample }: { busy: boolean; onUseExample: (sql: string) => void }) {
  return <section className="sql-guide" aria-labelledby="sql-guide-title">
    <h2 id="sql-guide-title" tabIndex={-1}>SQL guide</h2>
    <p className="sidebar-note">A SQLite quick reference. Examples load into your current editor without running or checking an answer.</p>
    <details className="sql-clause-order">
      <summary>Query structure</summary>
      <p>Write clauses in this order. Leave out the ones you do not need.</p>
      <pre><code>{`SELECT columns
FROM table_name
JOIN other_table ON condition
WHERE row_condition
GROUP BY columns
HAVING group_condition
ORDER BY columns
LIMIT row_count;`}</code></pre>
    </details>
    {SQL_GUIDE_TOPICS.map(topic => <details key={topic.title}>
      <summary>{topic.title}</summary>
      <div className="sql-guide-body">
        <p>{topic.explanation}</p>
        <pre><code>{topic.sql}</code></pre>
        <button className="btn" disabled={busy} onClick={() => onUseExample(topic.sql)}>Load example</button>
      </div>
    </details>)}
  </section>;
}
