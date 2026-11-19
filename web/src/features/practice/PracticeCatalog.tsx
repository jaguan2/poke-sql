import { useEffect, useRef } from "react";
import { SAMPLE_QUERIES } from "./samples";
import { CHALLENGES } from "./challenges";
import type { CatalogFilters, CatalogKind, PracticeTopic } from "./types";
import "./PracticeCatalog.css";

const TOPICS: Record<PracticeTopic, { id: PracticeTopic; label: string; detail: string; symbol: string }> = {
  basics: { id: "basics", label: "SQL basics", detail: "SELECT, WHERE & NULL", symbol: "01" },
  sorting: { id: "sorting", label: "Sort & filter", detail: "ORDER BY, LIMIT & flags", symbol: "02" },
  joins: { id: "joins", label: "Connect tables", detail: "JOINs & relationships", symbol: "03" },
  aggregation: { id: "aggregation", label: "Group & count", detail: "Aggregates & GROUP BY", symbol: "04" },
  advanced: { id: "advanced", label: "Go further", detail: "Subqueries, windows & CTEs", symbol: "05" },
};

interface Props {
  kind: CatalogKind; filters: CatalogFilters; completed: string[]; drafts: Record<string, string>; busy: boolean;
  onFiltersChange: (filters: CatalogFilters) => void; onSelect: (id: string) => void; onFreePractice: () => void;
}

export function PracticeCatalog({ kind, filters, completed, drafts, busy, onFiltersChange, onSelect, onFreePractice }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  useEffect(() => { page.current?.scrollIntoView({ block: "start" }); heading.current?.focus({ preventScroll: true }); }, [kind]);
  const challenges = kind === "challenges";
  const questions = challenges ? CHALLENGES : SAMPLE_QUERIES;
  const state = (id: string) => challenges && completed.includes(id) ? "completed" : drafts[challenges ? id : `sample:${id}`]?.trim() ? "draft" : "ready";
  const search = filters.search.trim().toLocaleLowerCase();
  const visible = questions.filter(question => (filters.category === "all" || question.category === filters.category)
    && (filters.status === "all" || state(question.id) === filters.status)
    && `${question.title} ${question.prompt} ${question.difficulty} ${TOPICS[question.category].label}`.toLocaleLowerCase().includes(search));
  const completeCount = CHALLENGES.filter(question => completed.includes(question.id)).length;
  return <section className="practice-catalog" ref={page} aria-labelledby="catalog-title">
    <header className="catalog-heading"><div><span className="eyebrow">Practice your SQL skills</span><h2 id="catalog-title" ref={heading} tabIndex={-1}>{challenges ? "Challenges" : "Get started"}</h2>
      <p>{challenges ? "Put your skills to the test. Solve a specific Pokémon problem and check your answer." : "Pick a Pokémon question, write a little SQL, and learn at your own pace."}</p></div>
      <button className="btn" disabled={busy} onClick={onFreePractice}>Free practice</button></header>
    <div className="catalog-overview"><span><strong>{questions.length}</strong> {challenges ? "SQL challenges" : "guided questions"}</span><span>{challenges ? `${completeCount} completed` : "Hints & worked answers included"}</span><span>{challenges ? "Checked against the original Pokédex" : "Works with your practice database"}</span></div>
    <section className="catalog-skills" aria-label="Practice topics">{Object.values(TOPICS).map(topic => <button key={topic.id} aria-pressed={filters.category === topic.id} onClick={() => onFiltersChange({ ...filters, category: filters.category === topic.id ? "all" : topic.id })}>
      <span className="catalog-skill-icon" aria-hidden="true">{topic.symbol}</span><span><strong>{topic.label}</strong><small>{topic.detail}</small></span><span className="catalog-topic-count">{questions.filter(question => question.category === topic.id).length}</span>
    </button>)}</section>
    <div className="catalog-filters"><label><span>Find a question</span><input type="search" placeholder="Search Pokémon, questions or SQL skills…" value={filters.search} onChange={event => onFiltersChange({ ...filters, search: event.target.value })} /></label>
      <label><span>Progress</span><select aria-label="Progress" value={filters.status} onChange={event => onFiltersChange({ ...filters, status: event.target.value as CatalogFilters["status"] })}><option value="all">All questions</option><option value="draft">Saved drafts</option>{challenges && <option value="completed">Completed</option>}</select></label>
      <button className="btn" onClick={() => onFiltersChange({ search: "", category: "all", status: "all" })}>Clear filters</button></div>
    <div className="catalog-results-heading"><h3>{filters.category === "all" ? "All questions" : TOPICS[filters.category].label}</h3><span role="status">{visible.length} of {questions.length} questions</span></div>
    <div className="catalog-questions">{visible.map(question => {
      const status = state(question.id);
      return <article className="catalog-question" key={question.id} aria-label={question.title}>
        <div className="catalog-question-meta"><span className={`question-difficulty is-${question.difficulty.toLowerCase()}`}>{question.difficulty}</span><span>{TOPICS[question.category].label}</span><span className="question-status" data-state={status}>{status === "completed" ? "✓ Completed" : status === "draft" ? "Saved draft" : challenges ? "Unsolved" : "Guided practice"}</span></div>
        <h3><button disabled={busy} aria-label={`${status === "completed" ? "✓. " : ""}${question.title}`} onClick={() => onSelect(question.id)}><span>{question.title}</span><small aria-hidden="true">{status === "completed" ? "Practice again" : status === "draft" ? "Continue" : "Start"} →</small></button></h3>
        <p>{question.prompt}</p>
      </article>;
    })}</div>
    {visible.length === 0 && <div className="catalog-empty"><h3>No matching questions</h3><p>Try another Pokémon or SQL topic, or clear your filters to see every question.</p><button className="btn" onClick={() => onFiltersChange({ search: "", category: "all", status: "all" })}>Show all questions</button></div>}
  </section>;
}
