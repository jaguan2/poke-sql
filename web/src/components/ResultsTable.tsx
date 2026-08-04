import type { QueryExecResult } from "sql.js";

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

type CellValue = number | string | Uint8Array | null;

function Cell({ column, value }: { column: string; value: CellValue }) {
  if (value === null) return <span className="cell-null">NULL</span>;
  if (value instanceof Uint8Array) return <span className="cell-null">&lt;blob&gt;</span>;

  const text = String(value);
  if (typeof value === "string" && column.endsWith("sprite_url") && text.startsWith("http")) {
    return <img className="sprite" src={text} alt="" loading="lazy" width={48} height={48} />;
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

export function ResultsTable({ result }: { result: QueryExecResult }) {
  const rows = result.values.slice(0, MAX_ROWS);
  return (
    <div className="result-block">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {result.columns.map((c, i) => (
                <th key={i}>{c}</th>
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
      {result.values.length > MAX_ROWS && (
        <div className="row-cap-note">
          Showing first {MAX_ROWS} of {result.values.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
