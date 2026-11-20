import { useEffect, useRef } from "react";
import type { MysteryRound } from "./model";
import { MYSTERY_HISTORY_LIMIT, mysterySolved } from "./model";
import type { NumberClue, TypeClue } from "./types";
import { MysteryEncounter } from "./MysteryEncounter";
import type { TrainerId } from "../../shared/trainer/profile";
import "./PokemonMystery.css";

export function MysteryPanel({ round, busy, mode, date, today, onDaily, onRandom, onNew, onLeave, trainer, ballTheme }: {
  round: MysteryRound | null;
  busy: boolean;
  mode: "daily" | "random";
  date?: string;
  today: string;
  trainer: TrainerId;
  ballTheme: string;
  onDaily: () => void;
  onRandom: () => void;
  onNew: () => void;
  onLeave: () => void;
}) {
  return <section className="practice-panel mystery-panel" aria-label="Who’s That Pokémon?">
    <div className="challenge-heading"><button className="sample-btn" disabled={busy} onClick={onLeave}>Back to free practice</button></div>
    <div className="mystery-heading"><h2>Who’s That Pokémon?</h2>{mode === "random" && <button className="btn" disabled={busy} onClick={onNew}>New Pokémon</button>}</div>
    <div className="mystery-modes" aria-label="Mystery mode">
      <button className="btn" aria-pressed={mode === "daily"} disabled={busy} onClick={onDaily}>Daily challenge</button>
      <button className="btn" aria-pressed={mode === "random"} disabled={busy} onClick={onRandom}>Random practice</button>
    </div>
    {mode === "daily" && <p className="mystery-date"><time dateTime={date}>{date}</time> · UTC · New challenge daily at 00:00 UTC</p>}
    {mode === "daily" && date && date !== today && <p className="notice" role="status">Today's daily challenge is available. This round stays on {date} so you can finish it. <button className="btn" disabled={busy} onClick={onDaily}>Open today's challenge</button></p>}
    {round && <MysteryEncounter key={`${mode}:${mode === "daily" ? date : round.id ?? round.targetId}`} round={round} daily={mode === "daily"} trainer={trainer} ballTheme={ballTheme} />}
    <p>Use the sprite and SQL clues to identify the Pokémon. A correct guess catches it and reveals its name.</p>
    <div className="mystery-legend" aria-label="Clue legend"><span>✓ Green: exact</span><span>↔ Yellow: type in the other slot</span><span>↑ / ↓: look higher / lower</span><span>×: no match</span></div>
    <details><summary>How to play</summary>
      <p>Return exactly one row with an <code>id</code> or <code>name</code> column to submit a guess. Try <code>SELECT * FROM pokedex WHERE name = 'Pikachu';</code>, then use the clues to refine your next query.</p>
      <p>Broader results and queries without a Pokémon id or name are research only and do not use a guess. Each guess compares the Pokémon’s original traits. A missing second type is shown as None; it is exact only when the hidden Pokémon also has one type.</p>
      <p>Several Pokémon can share all five traits. Find the exact species to win. There is no guess limit; the notebook keeps the latest {MYSTERY_HISTORY_LIMIT} guesses. Daily progress and random practice save separately. Random practice lets you choose New Pokémon whenever you like.</p>
    </details>
    <small>{round ? `${round.guessCount} guess${round.guessCount === 1 ? "" : "es"} · ${mysterySolved(round) ? "Mystery solved" : "Mystery in progress"}` : busy ? "Choosing a hidden Pokémon…" : "Choose New Pokémon to start."} · Your practice database stays separate.</small>
  </section>;
}

function ClueCell({ label, value, clue, higher, lower }: { label: string; value: string; clue: NumberClue | TypeClue; higher?: string; lower?: string }) {
  const explanation = clue === "correct" ? "✓ Exact" : clue === "partial" ? "↔ Other slot" : clue === "higher" ? `↑ ${higher}` : clue === "lower" ? `↓ ${lower}` : "× No match";
  return <td className={`mystery-clue clue-${clue}`}><span className="clue-label" aria-hidden="true">{label}</span><strong>{value}</strong><span>{explanation}</span></td>;
}

export function MysteryNotebook({ round, daily = false, onOpenPokedex, onOpenPc }: { round: MysteryRound; daily?: boolean; onOpenPokedex: () => void; onOpenPc: () => void }) {
  const notebook = useRef<HTMLElement>(null);
  const solved = round.attempts.find(attempt => attempt.feedback.matched);
  useEffect(() => {
    if (round.guessCount > 0 && !solved) notebook.current?.scrollIntoView({ block: "nearest" });
  }, [round.guessCount, solved]);
  const latest = round.attempts[round.attempts.length - 1]?.feedback;
  const sharedTraits = latest && !latest.matched && [latest.type1, latest.type2, latest.generation, latest.height, latest.weight].every(clue => clue === "correct");
  return <section ref={notebook} className="mystery-notebook" aria-label="Mystery notebook">
    {solved && <div className="reset-notice" role="status">You found {solved.feedback.pokemon.name} in {round.guessCount} guess{round.guessCount === 1 ? "" : "es"}! {daily ? "Daily challenge completed. Come back tomorrow or try Random practice." : "Choose New Pokémon to play again."}<div className="mystery-win-actions"><button className="btn" onClick={onOpenPokedex}>View Pokédex</button><button className="btn" onClick={onOpenPc}>Open PC Boxes</button></div></div>}
    {sharedTraits && <p className="notice" role="status">All five traits match, but this is a different species. Keep looking for the hidden Pokémon.</p>}
    {round.attempts.length > 0 && <>
      <h3>Guess history <small>Newest first{round.guessCount > MYSTERY_HISTORY_LIMIT ? ` · latest ${MYSTERY_HISTORY_LIMIT}` : ""}</small></h3>
      <div className="mystery-table-scroll" role="region" aria-label="Pokémon clue comparisons" tabIndex={0}>
        <table className="mystery-table"><thead><tr><th scope="col">Your guess</th><th scope="col">Type 1</th><th scope="col">Type 2</th><th scope="col">Generation</th><th scope="col">Height</th><th scope="col">Weight</th></tr></thead>
          <tbody>{round.attempts.slice().reverse().map(({ sql, feedback }, index) => <tr key={round.guessCount - index}>
            <td className="mystery-pokemon"><div><img src={`${import.meta.env.BASE_URL}sprites/${feedback.pokemon.id}.png`} alt="" width={40} height={40} /><strong>{round.guessCount - index}. {feedback.pokemon.name}</strong></div>
              <details><summary>SQL used</summary><pre>{sql}</pre></details></td>
            <ClueCell label="Type 1" value={feedback.pokemon.type1} clue={feedback.type1} />
            <ClueCell label="Type 2" value={feedback.pokemon.type2 ?? "None"} clue={feedback.type2} />
            <ClueCell label="Generation" value={`Gen ${feedback.pokemon.generationId}`} clue={feedback.generation} higher="Later" lower="Earlier" />
            <ClueCell label="Height" value={`${feedback.pokemon.heightM.toLocaleString()} m`} clue={feedback.height} higher="Taller" lower="Shorter" />
            <ClueCell label="Weight" value={`${feedback.pokemon.weightKg.toLocaleString()} kg`} clue={feedback.weight} higher="Heavier" lower="Lighter" />
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
