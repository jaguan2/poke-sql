import type { SqlAnswer } from "./types";

interface QueryHelpProps {
  hint: string;
  hintSql: string;
  answer: string;
  alternatives?: SqlAnswer[];
  busy: boolean;
  onUseAnswer: (sql: string) => void;
}

export function QueryHelp({ hint, hintSql, answer, alternatives = [], busy, onUseAnswer }: QueryHelpProps) {
  return <div className="query-help">
    <details><summary>Hint</summary><p>{hint}</p><pre><code>{hintSql}</code></pre></details>
    <details>
      <summary>Answer</summary>
      <p>These are worked examples. Other SQL can return the same result. Revealing an answer does not run or grade it.</p>
      {[{ title: "Direct approach", sql: answer }, ...alternatives].map(solution => <article className="worked-answer" aria-label={solution.title} key={solution.title}>
        <h3>{solution.title}</h3><pre><code>{solution.sql}</code></pre>
        <button className="btn" disabled={busy} onClick={() => onUseAnswer(solution.sql)}>Use this answer</button>
      </article>)}
    </details>
  </div>;
}
