import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { SafariSession } from "./types";
import type { Direction, SafariZoneDefinition } from "./zones";
import { routeCamera, rustlingPatch, tileAt, zoneById } from "./zones";
import { isRegionLocation, regionFor, regionPortals } from "./regions";
import type { WeatherId } from "./zones";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import type { TrainerId } from "../../shared/trainer/profile";
import { SafariRanger } from "./SafariRanger";
import { RANGER_POSITIONS, rangerSighting } from "./ranger";

const keyDirection: Record<string, Direction> = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };
const controlsKey = "pokesql:safari-controls-seen";
const walkingPaused = () => document.querySelector("dialog:modal, .safari-area-picker[open], .safari-events[open], .region-map[open]") !== null;

export function SafariMap({ zone, session, active, rustling, weather, date, onMove, trainer }: { zone: SafariZoneDefinition; session: SafariSession; active: boolean; rustling: boolean; weather: WeatherId; date: string; onMove: (direction: Direction) => void; trainer: TrainerId }) {
  const map = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const [showControls, setShowControls] = useState(() => {
    try { return sessionStorage.getItem(controlsKey) !== "yes"; } catch { return true; }
  });
  const dismissControls = useCallback(() => {
    setShowControls(false);
    try { sessionStorage.setItem(controlsKey, "yes"); } catch { /* Walking still works when storage is unavailable. */ }
  }, []);
  const move = useCallback((direction: Direction) => { if (showControls) dismissControls(); onMove(direction); }, [showControls, dismissControls, onMove]);
  useEffect(() => { swipe.current = null; if (active) map.current?.focus({ preventScroll: true }); }, [active, zone.id]);
  useEffect(() => {
    if (!active) return;
    const walk = (event: KeyboardEvent) => {
      const direction = keyDirection[event.key.toLowerCase()];
      if (!direction || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || walkingPaused()) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], audio, video")) return;
      event.preventDefault();
      map.current?.focus();
      move(direction);
    };
    window.addEventListener("keydown", walk);
    return () => window.removeEventListener("keydown", walk);
  }, [active, move]);
  useEffect(() => {
    const cancel = () => { swipe.current = null; };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => { window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  const frame = session.direction === "down" ? [0, 3, 0, 4][session.steps % 4] : session.direction === "up" ? [1, 5, 1, 6][session.steps % 4] : [2, 7, 2, 8][session.steps % 4];
  const patch = useMemo(() => rustlingPatch(zone, session.catches, session.position), [zone, session.catches, session.position]);
  const inGrass = tileAt(zone, session.position) === "g";
  const width = zone.map[0].length, height = zone.map.length;
  const camera = routeCamera(zone, session.position);
  const ranger = isRegionLocation(zone.id) ? undefined : RANGER_POSITIONS[zone.id];
  const rangerVisible = ranger && ranger.x >= camera.x && ranger.x < camera.x + camera.width && ranger.y >= camera.y && ranger.y < camera.y + camera.height;
  const terrain = `${import.meta.env.BASE_URL}safari/${regionFor(zone.id)?.id ?? "maps"}/${zone.id}.png`;
  const exits = regionPortals(zone.id).filter((portal, index, all) => all.findIndex(other => other.to === portal.to && Math.abs(other.x - portal.x) <= 2 && Math.abs(other.y - portal.y) <= 2) === index);
  const position = (x: number, y: number): CSSProperties => ({ left: `${(x + 0.5) / width * 100}%`, top: `${(y + 0.5) / height * 100}%` });
  return <>
    <div className={`safari-map safari-terrain-${zone.encounterTerrain}${isRegionLocation(zone.id) ? " is-region" : ""}${rustling ? " is-rustling" : ""}`} ref={map} role="group" aria-label={`${zone.name} exploration map`} aria-describedby="safari-controls-help" tabIndex={active ? 0 : -1}
      data-camera-x={camera.x} data-camera-y={camera.y} style={{ aspectRatio: `${camera.width}/${camera.height}` }}
      onPointerDown={event => {
        if (!active || walkingPaused() || !event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
        map.current?.focus({ preventScroll: true });
        swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={event => {
        const start = swipe.current;
        swipe.current = null;
        if (!start || start.id !== event.pointerId || !active || walkingPaused()) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
      }}
      onPointerCancel={() => { swipe.current = null; }} onLostPointerCapture={() => { swipe.current = null; }}>
      <div className="safari-route-world" style={{ width: `${width / camera.width * 100}%`, height: `${height / camera.height * 100}%`, transform: `translate(${-camera.x / width * 100}%, ${-camera.y / height * 100}%)`, "--route-columns": width } as CSSProperties}>
        <img className="safari-terrain" src={terrain} alt="" width={width * 16} height={height * 16} draggable={false} />
        <span className="safari-trailhead" style={position(zone.start.x, zone.start.y)} aria-hidden="true">⚑</span>
        {patch && <span className="safari-rustle" style={position(patch.x, patch.y)} data-x={patch.x} data-y={patch.y} aria-hidden="true"><span>✦</span><i className="safari-hotspot-grass" /></span>}
        {exits.map(exit => <span key={`${exit.x}-${exit.y}`} className="safari-exit" style={position(Math.max(0, Math.min(exit.x, width - 1)), Math.max(0, Math.min(exit.y, height - 1)))} aria-hidden="true">{exit.y < 0 ? "↑" : exit.y >= height ? "↓" : exit.x < 0 ? "←" : exit.x >= width ? "→" : "↕"}<span>{zoneById(exit.to).name}</span></span>)}
        <div className="safari-player" style={position(session.position.x, session.position.y)} data-x={session.position.x} data-y={session.position.y} data-facing={session.direction}>
          <TrainerSprite trainer={trainer} pose="walking" frame={frame} flipped={session.direction === "right"} className="safari-trainer" />
        </div>
        {rangerVisible && <SafariRanger style={position(ranger.x, ranger.y)} active={active} trainer={trainer}
          sighting={rangerSighting(zone, weather, session.lastCatch?.pokemon.id, date)} />}
        {inGrass && <span key={session.steps} className="safari-grass-contact" style={position(session.position.x, session.position.y)} aria-hidden="true" />}
      </div>
      <div className={`safari-weather safari-weather-${weather}`} aria-hidden="true" />
      <span className="safari-map-label">{zone.routeName}</span>
      <p id="safari-controls-help" hidden>Use WASD or arrow keys to walk, or swipe the map. Open menus and typing pause walking.</p>
      {showControls && <aside className="safari-controls-popup" aria-label="Safari controls">
        <p>Use <kbd>WASD</kbd> or <kbd>arrow keys</kbd> to walk.</p>
        <p>On a touchscreen, swipe the map.</p>
        <button type="button" className="btn btn-primary" onClick={dismissControls}>Got it</button>
      </aside>}
      {rustling && <p className="safari-grass-alert" role="status">{zone.encounterTerrain === "grass" ? "Something is moving in the grass!" : "Something is moving nearby!"}</p>}
    </div>
    <details className="safari-route-overview"><summary>Route map <span>{isRegionLocation(zone.id) ? "Your position and exits" : "Find the trailhead and shaking patch"}</span></summary>
      <div className="safari-route-miniature" style={{ width: Math.min(640, width * 12, 300 * width / height), aspectRatio: `${width}/${height}` }} role="img" aria-label={`${zone.routeName} overview: your position, trailhead, and shaking patch`}>
        <img src={terrain} alt="" width={width * 16} height={height * 16} draggable={false} />
        <span className="safari-mini-start" style={position(zone.start.x, zone.start.y)} aria-hidden="true">⚑</span>
        {ranger && <span className="safari-mini-ranger" style={position(ranger.x, ranger.y)} aria-hidden="true">!</span>}
        {patch && <span className="safari-mini-patch" style={position(patch.x, patch.y)} aria-hidden="true">✦</span>}
        {exits.map(exit => <span key={`${exit.x}-${exit.y}`} className="safari-mini-start" style={position(Math.max(0, Math.min(exit.x, width - 1)), Math.max(0, Math.min(exit.y, height - 1)))} title={zoneById(exit.to).name}>↕</span>)}
        <span className="safari-mini-player" style={position(session.position.x, session.position.y)} aria-hidden="true">●</span>
      </div><p>● You · ⚑ Start{ranger ? " · ! Ranger" : ""}{patch ? " · ✦ Shaking patch" : ""}{exits.length ? " · ↕ Exit" : ""}</p><p className="safari-position" role="status">Trail position {session.position.x + 1}, {session.position.y + 1} · {session.steps} steps</p>
    </details>
  </>;
}
