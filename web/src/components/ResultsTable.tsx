import type { SqlValue } from "sql.js";
import type { QueryResult } from "../db";

const MAX_ROWS = 500;

/** Classic Pokémon type colors, used to badge type values in results. */
const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
  stellar: "#40B5A5",
};

function Cell({ column, value }: { column: string; value: SqlValue }) {
  if (value === null) return <span className="cell-null">NULL</span>;
  if (value instanceof Uint8Array) return <span className="cell-null">&lt;blob&gt;</span>;

  const text = String(value);
  const sprite = text.match(/^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(\d+)\.png$/)
    ?? text.match(/^sprites\/(\d+)\.png$/);
  if (column.endsWith("sprite_url") && sprite) {
    return <img className="sprite" src={`${import.meta.env.BASE_URL}sprites/${sprite[1]}.png`} alt="" loading="lazy" width={48} height={48}
      onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = `${import.meta.env.BASE_URL}pokeball.svg`; }} />;
  }
  const typeColor = column.toLowerCase().includes("type") ? TYPE_COLORS[text] : undefined;
  if (typeColor) {
    return (
      <span className="type-badge" style={{ backgroundColor: typeColor }}>
        {text}
      </span>
    );
  }
  return <span className={typeof value === "number" ? "cell-num" : undefined}>{text}</span>;
}

export function ResultsTable({ result }: { result: QueryResult }) {
  const rows = result.values.slice(0, MAX_ROWS);
  const notes: string[] = [];
  if (rows.length < result.values.length) {
    notes.push(`showing first ${MAX_ROWS} of ${result.values.length.toLocaleString()} fetched rows`);
  }
  if (result.truncated) {
    notes.push("query stopped early — add a LIMIT clause to control the result size");
  }
  return (
    <div className="result-block">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} scope="col">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((v, ci) => (
                  <td key={ci}>
                    <Cell column={result.columns[ci]} value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.length > 0 && <div className="row-cap-note">{notes.join("; ")}</div>}
    </div>
  );
}
