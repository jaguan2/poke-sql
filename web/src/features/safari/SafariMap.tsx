import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { SafariSession } from "./types";
import type { Direction, SafariZoneDefinition } from "./zones";
import { routeCamera, rustlingPatch, tileAt } from "./zones";
import type { WeatherId } from "./zones";

function TrainerSprite({ frame = 0, flipped = false, className = "" }: { frame?: number; flipped?: boolean; className?: string }) {
  const position = `${frame / 8 * 100}% 0%`;
  return <span className={`safari-trainer ${className}`} style={{ backgroundPosition: position, transform: flipped ? "scaleX(-1)" : undefined }} aria-hidden="true" />;
}

const keyDirection: Record<string, Direction> = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };

export function SafariMap({ zone, session, active, rustling, weather, onMove }: { zone: SafariZoneDefinition; session: SafariSession; active: boolean; rustling: boolean; weather: WeatherId; onMove: (direction: Direction) => void }) {
  const map = useRef<HTMLDivElement>(null);
  const holding = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (holding.current) clearInterval(holding.current); holding.current = null; };
  useEffect(() => { if (active) map.current?.focus({ preventScroll: true }); else stop(); return stop; }, [active, zone.id]);
  useEffect(() => {
    if (!active) return;
    const walk = (event: KeyboardEvent) => {
      const direction = keyDirection[event.key.toLowerCase()];
      if (!direction || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || document.querySelector("dialog:modal, .safari-area-picker[open]")) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], audio, video")) return;
      event.preventDefault();
      map.current?.focus();
      onMove(direction);
    };
    window.addEventListener("keydown", walk);
    return () => window.removeEventListener("keydown", walk);
  }, [active, onMove]);
  useEffect(() => {
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    document.addEventListener("pointerup", stop);
    return () => { stop(); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop); document.removeEventListener("pointerup", stop); };
  }, []);
  const frame = session.direction === "down" ? [0, 3, 0, 4][session.steps % 4] : session.direction === "up" ? [1, 5, 1, 6][session.steps % 4] : [2, 7, 2, 8][session.steps % 4];
  const patch = useMemo(() => rustlingPatch(zone, session.catches), [zone, session.catches]);
  const inGrass = tileAt(zone, session.position) === "g";
  const width = zone.map[0].length, height = zone.map.length;
  const camera = routeCamera(zone, session.position);
  const terrain = `${import.meta.env.BASE_URL}safari/maps/${zone.id}.png`;
  const position = (x: number, y: number): CSSProperties => ({ left: `${(x + 0.5) / width * 100}%`, top: `${(y + 0.5) / height * 100}%` });
  return <>
    <div className={`safari-map safari-terrain-${zone.encounterTerrain}${rustling ? " is-rustling" : ""}`} ref={map} role="group" aria-label={`${zone.name} exploration map`} aria-describedby="safari-controls-help" tabIndex={active ? 0 : -1}
      data-camera-x={camera.x} data-camera-y={camera.y} style={{ aspectRatio: `${camera.width}/${camera.height}` }}
      onPointerDown={() => map.current?.focus({ preventScroll: true })}>
      <div className="safari-route-world" style={{ width: `${width / camera.width * 100}%`, height: `${height / camera.height * 100}%`, transform: `translate(${-camera.x / width * 100}%, ${-camera.y / height * 100}%)`, "--route-columns": width } as CSSProperties}>
        <img className="safari-terrain" src={terrain} alt="" width={width * 16} height={height * 16} draggable={false} />
        <span className="safari-trailhead" style={position(zone.start.x, zone.start.y)} aria-hidden="true">⚑</span>
        <span className="safari-rustle" style={position(patch.x, patch.y)} data-x={patch.x} data-y={patch.y} aria-hidden="true"><span>✦</span><i className="safari-hotspot-grass" /></span>
        <div className="safari-player" style={position(session.position.x, session.position.y)} data-x={session.position.x} data-y={session.position.y} data-facing={session.direction}>
          <TrainerSprite frame={frame} flipped={session.direction === "right"} />
        </div>
        {inGrass && <span key={session.steps} className="safari-grass-contact" style={position(session.position.x, session.position.y)} aria-hidden="true" />}
      </div>
      <div className={`safari-weather safari-weather-${weather}`} aria-hidden="true" />
      <span className="safari-map-label">{zone.routeName}</span>
      {rustling && <p className="safari-grass-alert" role="status">{zone.encounterTerrain === "grass" ? "Something is moving in the grass!" : "Something is moving nearby!"}</p>}
    </div>
    <div className="safari-map-controls"><div><p id="safari-controls-help">Use <kbd>W A S D</kbd> or arrow keys to walk. Settings, the habitat picker and typing pause keyboard movement. You can also tap or hold the direction buttons.</p><p className="safari-position" role="status">Trail position {session.position.x + 1}, {session.position.y + 1} · {session.steps} steps</p></div>
      <div className="safari-dpad" aria-label="Movement controls">{(["up", "left", "down", "right"] as const).map(direction => <button key={direction} className={`safari-move-${direction}`} type="button" aria-label={`Move ${direction}`} disabled={!active}
        onPointerDown={event => { event.preventDefault(); stop(); onMove(direction); holding.current = setInterval(() => onMove(direction), 160); }}
        onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
        onClick={event => { if (event.detail === 0) onMove(direction); }}>{({ up: "↑", down: "↓", left: "←", right: "→" })[direction]}</button>)}</div>
    </div>
    <details className="safari-route-overview"><summary>Route map <span>Find the trailhead and shaking patch</span></summary>
      <div className="safari-route-miniature" style={{ width: Math.min(640, width * 12, 300 * width / height), aspectRatio: `${width}/${height}` }} role="img" aria-label={`${zone.routeName} overview: your position, trailhead, and shaking patch`}>
        <img src={terrain} alt="" width={width * 16} height={height * 16} draggable={false} />
        <span className="safari-mini-start" style={position(zone.start.x, zone.start.y)} aria-hidden="true">⚑</span>
        <span className="safari-mini-patch" style={position(patch.x, patch.y)} aria-hidden="true">✦</span>
        <span className="safari-mini-player" style={position(session.position.x, session.position.y)} aria-hidden="true">●</span>
      </div><p>● You · ⚑ Trailhead · ✦ Shaking patch</p>
    </details>
  </>;
}
