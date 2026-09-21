import { memo, useState } from "react";
import type { QueryResult } from "../db";
import { ResultsTable } from "./ResultsTable";

// A script can return 50 capped result sets. Mount only the selected table,
// and keep editor keystrokes from re-rendering unchanged result cells.
export const QueryResults = memo(function QueryResults({ results }: { results: QueryResult[] }) {
  const [selection, setSelection] = useState({ results, index: 0 });
  const index = selection.results === results ? selection.index : 0;
  if (!results.length) return null;
  return <>
    {results.length > 1 && <nav className="result-pagination" aria-label="Result sets">
      <button className="btn" disabled={index === 0} onClick={() => setSelection({ results, index: index - 1 })}>Previous result</button>
      <label>Result set <select aria-label="Result set" value={index} onChange={event => setSelection({ results, index: Number(event.target.value) })}>
        {results.map((result, i) => <option key={i} value={i}>{i + 1} of {results.length} · {result.values.length.toLocaleString()}{result.truncated ? "+" : ""} rows</option>)}
      </select></label>
      <button className="btn" disabled={index === results.length - 1} onClick={() => setSelection({ results, index: index + 1 })}>Next result</button>
    </nav>}
    <ResultsTable key={index} result={results[index]} />
  </>;
});
