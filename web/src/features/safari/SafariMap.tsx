import { memo, useEffect, useId, useRef } from "react";
import type { CSSProperties } from "react";
import type { SafariSession } from "./types";
import type { Direction, SafariZoneDefinition } from "./zones";

export function TrainerSprite({ frame = 0, flipped = false, className = "" }: { frame?: number; flipped?: boolean; className?: string }) {
  const position = `${frame / 8 * 100}% 0%`;
  return <span className={`safari-trainer ${className}`} style={{ backgroundPosition: position, maskPosition: position, transform: flipped ? "scaleX(-1)" : undefined }} aria-hidden="true" />;
}

const Terrain = memo(function Terrain({ zone }: { zone: SafariZoneDefinition }) {
  const prefix = useId().replace(/:/g, "");
  return <svg viewBox="0 0 480 320" aria-hidden="true" className="safari-terrain" shapeRendering="crispEdges">
    <defs>
      <pattern id={`${prefix}-ground`} width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill={zone.ground} /><path d="M3 7h3v2H3zM22 20h4v2h-4zM10 29h2v1h-2z" fill="#fff" opacity=".14" /><path d="M18 9h2v1h-2zM4 23h3v1H4z" fill="#1d4c3b" opacity=".12" /></pattern>
      <g id={`${prefix}-grass`}><path d="M1 30V13h3v8h3V8h3v11h3V6h3v13h3v-8h3v10h3V9h3v21z" fill={zone.grass} /><path d="M3 30V20h3v6h3V16h3v10h3V14h3v12h3v-8h3v12z" fill="#a5c979" opacity=".66" /><path d="M0 31h31v1H0z" fill="#2f5f48" opacity=".4" /></g>
      <g id={`${prefix}-tree`}><path d="M13 24h7v8h-7z" fill="#786649" /><path d="M9 3h14v3h5v7h4v12h-5v4H5v-4H1V13h4V6h4z" fill={zone.canopy} /><path d="M10 3h12v4h5v6h-5v4H5v-5h4V7h1z" fill="#629665" /><path d="M13 5h7v3h-7zM6 15h8v3H6z" fill="#a3bd70" opacity=".65" /><path d="M3 23h5v3h16v-3h5v4h-5v3H8v-3H3z" fill="#173f36" opacity=".5" /></g>
      <g id={`${prefix}-rock`}><path d="M6 7h20v5h4v16H2V12h4z" fill="#6f705d" /><path d="M7 5h16v4h5v10H5V10h2z" fill="#b6b597" /><path d="M8 9h11v3H8zM5 20h19v3H5z" fill="#dbd3b3" /><path d="M21 9h5v10h-5z" fill="#92937c" /></g>
    </defs>
    <rect width="480" height="320" fill={`url(#${prefix}-ground)`} />
    {zone.map.flatMap((row, y) => [...row].map((tile, x) => <g key={`${x},${y}`} transform={`translate(${x * 32} ${y * 32})`}>
      {(tile === "." || tile === "S") && <><rect width="32" height="32" fill={zone.id === "wetlands" ? "#c5c1a0" : "#d2c18f"} /><path d="M2 6h6M19 25h7M13 15h3" stroke="#ac9e73" strokeWidth="1" opacity=".5" /></>}
      {tile === "T" && <use href={`#${prefix}-tree`} />}
      {tile === "R" && <use href={`#${prefix}-rock`} />}
      {tile === "g" && <use href={`#${prefix}-grass`} className={x === zone.rustle.x && y === zone.rustle.y ? "safari-shaking-grass" : undefined} />}
      {tile === "~" && <><rect width="32" height="32" fill="#53978f" /><path d="M3 8h11M16 22h12M8 16h5" stroke="#a4d6bb" strokeWidth="2" className="safari-waterline" /></>}
      {tile === "S" && <path d="M14 7h4v6h5v4h-5v8h-4v-8H9v-4h5z" fill="#f1dfaa" opacity=".7" />}
      {tile === "g" && (x * 3 + y) % 13 === 0 && <path d="M13 10h4v4h-4zM11 12h8v2h-8z" fill={zone.id === "forest" ? "#f2d289" : "#d4e4ab"} />}
    </g>))}
    <path d="M208 290h64v12h-64z" fill="#345746" opacity=".25" />
    <text x="240" y="300" textAnchor="middle" fill="#f7efcf" fontFamily="monospace" fontSize="8" letterSpacing="2">TRAILHEAD</text>
  </svg>;
});

const keyDirection: Record<string, Direction> = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };

export function SafariMap({ zone, session, active, onMove }: { zone: SafariZoneDefinition; session: SafariSession; active: boolean; onMove: (direction: Direction) => void }) {
  const map = useRef<HTMLDivElement>(null);
  const holding = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (holding.current) clearInterval(holding.current); holding.current = null; };
  useEffect(() => { if (active) map.current?.focus({ preventScroll: true }); else stop(); return stop; }, [active]);
  useEffect(() => {
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    document.addEventListener("pointerup", stop);
    return () => { stop(); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop); document.removeEventListener("pointerup", stop); };
  }, []);
  const frame = session.direction === "down" ? [0, 3, 0, 4][session.steps % 4] : session.direction === "up" ? [1, 5, 1, 6][session.steps % 4] : [2, 7, 2, 8][session.steps % 4];
  const position = (x: number, y: number): CSSProperties => ({ left: `${(x + 0.5) / 15 * 100}%`, top: `${(y + 0.5) / 10 * 100}%` });
  return <>
    <div className="safari-map" ref={map} role="group" aria-label={`${zone.name} exploration map`} aria-describedby="safari-controls-help" tabIndex={active ? 0 : -1}
      onPointerDown={() => map.current?.focus({ preventScroll: true })}
      onKeyDown={event => {
        const direction = keyDirection[event.key.toLowerCase()];
        if (active && direction && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); onMove(direction); }
      }}>
      <Terrain zone={zone} />
      <span className="safari-rustle" style={position(zone.rustle.x, zone.rustle.y)} aria-hidden="true"><span>✦</span></span>
      <div className="safari-player" style={position(session.position.x, session.position.y)} data-x={session.position.x} data-y={session.position.y} data-facing={session.direction}>
        <TrainerSprite frame={frame} flipped={session.direction === "right"} />
      </div>
      <span className="safari-map-label">{zone.subtitle}</span>
    </div>
    <div className="safari-map-controls"><div><p id="safari-controls-help">Click the map, then use <kbd>W A S D</kbd> or arrow keys. Tap or hold the direction buttons to walk.</p><p className="safari-position" role="status">Trail position {session.position.x + 1}, {session.position.y + 1} · {session.steps} steps</p></div>
      <div className="safari-dpad" aria-label="Movement controls">{(["up", "left", "down", "right"] as const).map(direction => <button key={direction} className={`safari-move-${direction}`} type="button" aria-label={`Move ${direction}`} disabled={!active}
        onPointerDown={event => { event.preventDefault(); stop(); onMove(direction); holding.current = setInterval(() => onMove(direction), 160); }}
        onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
        onClick={event => { if (event.detail === 0) onMove(direction); }}>{({ up: "↑", down: "↓", left: "←", right: "→" })[direction]}</button>)}</div>
    </div>
  </>;
}
