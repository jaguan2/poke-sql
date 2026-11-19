import type { safariAssignment } from "./assignments";
import type { QueryResult } from "../../shared/sql/types";
import { QueryResults } from "../../shared/ui/QueryResults";

export function SafariFledSummary({ name, attempts, assignment, draft, feedback, results, onLeave }: {
  name: string; attempts: number; assignment: ReturnType<typeof safariAssignment>;
  draft: string; feedback: string; results: QueryResult[]; onLeave: () => void;
}) {
  return <div className="safari-fled-summary">
    <h3>{name} slipped away.</h3>
    <p>After {attempts} incorrect answers, {name} fled. You can encounter it here again.</p>
    <p className="notice" role="status">{feedback || "The last result did not match the requested columns, values or ordering."}</p>
    <details><summary>Review a solution</summary>
      <p>{assignment.prompt}</p><p>{assignment.hint}</p>
      <h4>Your last query</h4><pre><code>{draft}</code></pre>
      <h4>One correct solution</h4><pre><code>{assignment.sql}</code></pre>
      <p>Other SQL approaches that return the requested results also work.</p>
    </details>
    {results.length > 0 && <details><summary>Review your last results</summary><QueryResults results={results} /></details>}
    <button className="btn btn-primary" onClick={onLeave}>Keep exploring</button>
  </div>;
}
