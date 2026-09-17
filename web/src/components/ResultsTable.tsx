import { useEffect, useRef, useState } from "react";
import type { SqlValue } from "sql.js";
import type { QueryResult } from "../db";

const PAGE_SIZE = 500;

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

/** Pick the higher-contrast text color using WCAG relative luminance. */
function badgeTextColor(hex: string): string {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000" : "#fff";
}

function Cell({ column, value }: { column: string; value: SqlValue }) {
  if (value === null) return <span className="cell-null">NULL</span>;
  if (value instanceof Uint8Array) return <span className="cell-null">&lt;blob&gt;</span>;

  const text = String(value);
  const sprite = text.match(/^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(\d+)\.png$/)
    ?? text.match(/^sprites\/(\d+)\.png$/);
  if (column.endsWith("sprite_url") && sprite) {
    return <img className="sprite" src={`${import.meta.env.BASE_URL}sprites/${sprite[1]}.png`} alt="" loading="lazy" width={48} height={48}
      onError={event => { const fallback = new URL(`${import.meta.env.BASE_URL}pokeball.svg`, location.href).href; if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback; }} />;
  }
  const typeColor = column.toLowerCase().includes("type") && Object.prototype.hasOwnProperty.call(TYPE_COLORS, text)
    ? TYPE_COLORS[text] : undefined;
  if (typeColor) {
    return (
      <span className="type-badge" style={{ backgroundColor: typeColor, color: badgeTextColor(typeColor) }}>
        {text}
      </span>
    );
  }
  return <span className={typeof value === "number" ? "cell-num" : undefined}>{text}</span>;
}

export function ResultsTable({ result }: { result: QueryResult }) {
  const [pageState, setPageState] = useState({ result, index: 0 });
  // A replacement result always starts on its first page.
  const page = pageState.result === result ? pageState.index : 0;
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [page, result]);
  const start = page * PAGE_SIZE;
  const rows = result.values.slice(start, start + PAGE_SIZE);
  const notes: string[] = [];
  if (result.truncated) {
    notes.push("query stopped early — add a LIMIT clause to control the result size");
  }
  return (
    <div className="result-block">
      {result.values.length > PAGE_SIZE && <nav className="result-pagination" aria-label="Result pages">
        <button className="btn" disabled={page === 0} onClick={() => setPageState({ result, index: page - 1 })}>Previous rows</button>
        <span role="status">Rows {start + 1}–{start + rows.length} of {result.values.length.toLocaleString()}{result.truncated ? "+" : ""}</span>
        <button className="btn" disabled={start + PAGE_SIZE >= result.values.length} onClick={() => setPageState({ result, index: page + 1 })}>Next rows</button>
      </nav>}
      <div className="table-scroll" ref={scroll} tabIndex={0} role="region" aria-label="Query results">
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
