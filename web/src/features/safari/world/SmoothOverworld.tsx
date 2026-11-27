import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SafariSession } from "../types";
import { isZoneId, zoneById } from "../zones";
import type { TrainerId } from "../../../shared/trainer/profile";
import { worldAssets, hasWorldMap, type WorldAsset } from "./assets";
import { advancePlayer, canStand, createPlayer, traverse, type Player } from "./physics";
import { canInteract, spawnWild, wanderWild, type WildPokemon } from "./wild";
import { renderOverworld, createImages, type PlacedMap } from "./render";
import type { TerrainMap } from "./terrain";
import "./overworld.css";

type Snapshot = NonNullable<SafariSession["exploration"]>;
interface Props {
  session: SafariSession; trainer: TrainerId; date: string; registeredIds: readonly number[];
  onSave: (snapshot: Snapshot, steps: number) => void;
  onInteract: (pokemonId: number, id: string, aquatic: boolean, snapshot: Snapshot, steps: number) => void;
  onPokedex: () => void;
}
const keys: Record<string, [number, number]> = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest("input,textarea,select,[contenteditable=true],[role=textbox]");

export function SmoothOverworld(props: Props) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), current = useRef(props);
  useLayoutEffect(() => { current.current = props; });
  const commands = useRef<{ save: () => void; interact: (id?: string) => void; traverse: () => void; pause: () => void; teleport: () => void; press: (id: string, x: number, y: number) => void; release: (id: string) => void }>();
  const settings = useRef({ autoSurf: props.session.exploration?.autoSurf ?? false, run: false, paused: false, debug: false });
  const [hud, setHud] = useState({ ready: false, map: props.session.zoneId as string, mode: "walking", x: 0, y: 0, elevation: 0, fps: 0, error: "", near: [] as WildPokemon[], visible: [] as WildPokemon[] });
  const [paused, setPaused] = useState(false);
  const debug = import.meta.env.DEV || new URLSearchParams(location.search).get("debug") === "overworld";
  useEffect(() => {
    const node = root.current, display = canvas.current;
    if (!node || !display) return;
    display.width = 384; display.height = 256;
    let disposed = false, player: Player | undefined, origin = { x: 0, y: 0 }, camera = { x: 0, y: 0 };
    let wild: WildPokemon[] = [], wildKey = "", lastHud = 0, time = 0, previous = 0, savedDistance = 0, lastSave = 0, locking = false;
    let generation = 0, frame = 0, lastMoving = false, epoch = 0;
    const assets = new Map<string, WorldAsset>(), leases = new Map<string, ReturnType<typeof worldAssets.acquire>>();
    const held = new Map<string, [number, number]>(), images = createImages();
    const terrainMaps = () => new Map([...assets].flatMap(([id, asset]) => asset.terrain ? [[id, asset.terrain] as [string, TerrainMap]] : []));
    const snapshot = (): [Snapshot, number] => {
      const p = player!;
      const count = Math.floor(p.distance) - savedDistance; savedDistance += count;
      return [{ enabled: true, mapId: p.mapId, x: p.position.x, y: p.position.y, direction: p.direction, mode: p.mode, autoSurf: settings.current.autoSurf, generation: epoch }, count];
    };
    const save = () => { if (player && !player.transition && !locking && current.current.session.exploration?.enabled) { current.current.onSave(...snapshot()); lastSave = time; } };
    const clear = () => { held.clear(); if (player) player.velocity = { x: 0, y: 0 }; save(); };
    const retain = (id: string) => {
      let lease = leases.get(id);
      if (!lease) { lease = worldAssets.acquire(id); leases.set(id, lease); }
      return lease.promise.then(asset => { if (!disposed && leases.get(id) === lease) assets.set(id, asset); return asset; });
    };
    const around = (id: string) => {
      const terrain = assets.get(id)?.terrain;
      if (!terrain) return;
      const wanted = new Set([id, ...terrain.connections.flatMap(c => c.runtimeDestination && hasWorldMap(c.runtimeDestination) ? [c.runtimeDestination] : [])]);
      for (const target of wanted) void retain(target).catch(() => {});
      for (const [target, lease] of leases) if (!wanted.has(target)) { lease.release(); leases.delete(target); assets.delete(target); }
    };
    const load = async () => {
      const version = ++generation, session = current.current.session;
      player = undefined; held.clear();
      if (!hasWorldMap(session.zoneId)) { setHud(h => ({ ...h, ready: false, error: "Smooth exploration is available in outdoor Kanto and Hoenn areas. Choose Classic movement here." })); return; }
      try {
        const asset = await retain(session.zoneId);
        if (disposed || version !== generation || !asset.terrain) return;
        const saved = session.exploration;
        epoch = saved?.generation ?? 0;
        const position = saved?.mapId === session.zoneId ? { x: saved.x, y: saved.y } : session.position;
        const mode = saved?.mapId === session.zoneId ? saved.mode : "walking";
        let candidate = createPlayer(asset.terrain, position, mode, session.direction);
        around(session.zoneId);
        // A saved feet box can straddle a seam. Load that adjoining surface
        // before deciding that the position is invalid and falling back to land.
        if (!canStand(terrainMaps(), candidate.mapId, position, mode, candidate.elevation)) {
          await Promise.allSettled(asset.terrain.connections.flatMap(c => c.runtimeDestination && hasWorldMap(c.runtimeDestination) ? [retain(c.runtimeDestination)] : []));
          if (disposed || version !== generation) return;
          if (!canStand(terrainMaps(), candidate.mapId, position, mode, candidate.elevation)) candidate = createPlayer(asset.terrain, session.position, "walking", session.direction);
        }
        player = candidate; savedDistance = 0; locking = false; wildKey = ""; origin = { x: 0, y: 0 };
        camera = { x: player.position.x + .5 - 12, y: player.position.y + .5 - 8 };
        around(player.mapId); node.focus({ preventScroll: true });
        setHud(h => ({ ...h, ready: true, error: "", map: player!.mapId }));
      } catch { if (!disposed) setHud(h => ({ ...h, ready: false, error: "Could not load this overworld. Return to Classic movement or reload to retry." })); }
    };
    const interact = (id?: string) => {
      if (!player || locking || settings.current.paused || player.transition) return;
      const map = assets.get(player.mapId)?.terrain;
      const entity = map && wild.find(p => (!id || p.id === id) && canInteract(player!, p, map));
      if (!entity) return;
      clear(); locking = true; entity.state = "encounter";
      current.current.onInteract(entity.pokemonId, entity.id, entity.aquatic, ...snapshot());
    };
    commands.current = { save, interact, traverse: () => { if (player && !locking && !settings.current.paused) player = traverse(player, terrainMaps()); },
      pause: () => { settings.current.paused = !settings.current.paused; clear(); setPaused(settings.current.paused); },
      teleport: () => { if (player?.mapId !== current.current.session.zoneId) { clear(); void load(); } },
      press: (id, x, y) => held.set(id, [x, y]), release: id => { held.delete(id); } };
    const keyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || typing(event.target) || !node.contains(document.activeElement)) return;
      const key = event.key.toLowerCase();
      if (keys[key]) { event.preventDefault(); held.set(key, keys[key]); }
      if (event.repeat) return;
      if (key === "shift") held.set("shift", [0, 0]);
      if (key === "e" || key === " ") { event.preventDefault(); interact(); }
      if (key === "f") { event.preventDefault(); commands.current?.traverse(); }
      if (key === "escape") { event.preventDefault(); commands.current?.pause(); }
      if (key === "p") { save(); current.current.onPokedex(); }
      if (key === "m") { clear(); const map = document.querySelector<HTMLDetailsElement>(".region-map"); if (map) map.open = !map.open; }
    };
    const keyUp = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()); };
    const focus = (event: FocusEvent) => { if (typing(event.target) || !node.contains(document.activeElement)) clear(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear); document.addEventListener("focusin", focus);
    const loop = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now; time += dt;
      const maps = terrainMaps(), p = player;
      const blocked = settings.current.paused || locking || document.hidden || !!document.querySelector("dialog:modal,.region-map[open],.safari-area-picker[open],.safari-events[open]");
      if (blocked) held.clear();
      if (p) {
        const vector = [...held.values()].reduce((sum, v) => ({ x: sum.x + v[0], y: sum.y + v[1] }), { x: 0, y: 0 });
        const next = blocked ? { ...p, velocity: { x: 0, y: 0 } } : advancePlayer(p, { ...vector, run: settings.current.run || held.has("shift"), autoSurf: settings.current.autoSurf }, dt, maps);
        player = next;
        if (next.mapId !== p.mapId) {
          const connection = assets.get(p.mapId)?.terrain?.connections.find(c => c.runtimeDestination === next.mapId);
          const other = assets.get(next.mapId)?.terrain, source = assets.get(p.mapId)?.terrain;
          if (connection && source && other) {
            const { direction, offset } = connection;
            origin = { x: origin.x + (direction === "left" ? -other.width : direction === "right" ? source.width : offset),
              y: origin.y + (direction === "up" ? -other.height : direction === "down" ? source.height : offset) };
          }
          around(next.mapId); save(); wildKey = "";
        }
        const asset = assets.get(next.mapId), terrain = asset?.terrain;
        if (terrain && isZoneId(next.mapId)) {
          const key = `${next.mapId}:${next.mode === "surfing"}:${current.current.session.catches}:${Math.floor(next.position.x / 6)}:${Math.floor(next.position.y / 6)}`;
          if (!blocked && key !== wildKey) {
            wildKey = key;
            wild = current.current.session.bag?.repelSteps ? [] : spawnWild(terrain, zoneById(next.mapId), next, `${current.current.date}:${key}`, current.current.date);
          }
          if (!blocked) for (const entity of wild) wanderWild(entity, terrain, time, dt);
          const placed: PlacedMap[] = [{ asset: asset!, ...origin }];
          for (const c of terrain.connections) {
            const neighbor = c.runtimeDestination && assets.get(c.runtimeDestination);
            if (!neighbor) continue;
            placed.push({ asset: neighbor, x: origin.x + (c.direction === "left" ? -neighbor.map.width : c.direction === "right" ? terrain.width : c.offset),
              y: origin.y + (c.direction === "up" ? -neighbor.map.height : c.direction === "down" ? terrain.height : c.offset) });
          }
          const follow = 1 - Math.exp(-14 * dt);
          camera.x += (origin.x + next.position.x + .5 - 12 - camera.x) * follow;
          camera.y += (origin.y + next.position.y + .5 - 8 - camera.y) * follow;
          renderOverworld(display, placed, origin, next, wild, current.current.trainer, camera, time, images, settings.current.debug);
          const moving = Math.hypot(next.velocity.x, next.velocity.y) > .03;
          if (!next.transition && (lastMoving && !moving || next.mode !== p.mode || time - lastSave > 2 && moving)) save();
          lastMoving = moving;
          node.dataset.map = next.mapId; node.dataset.x = next.position.x.toFixed(3); node.dataset.y = next.position.y.toFixed(3); node.dataset.mode = next.mode;
          node.dataset.cameraX = camera.x.toFixed(3); node.dataset.cameraY = camera.y.toFixed(3);
          if (time - lastHud > .25) {
            lastHud = time;
            setHud({ ready: true, error: "", map: next.mapId, mode: next.mode, x: next.position.x, y: next.position.y, elevation: next.elevation,
              fps: dt ? Math.round(1 / dt) : 0, near: wild.filter(entity => canInteract(next, entity, terrain)).map(entity => ({ ...entity })), visible: debug ? wild.map(entity => ({ ...entity, position: { ...entity.position } })) : [] });
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    void load(); frame = requestAnimationFrame(loop);
    return () => {
      save(); disposed = true; generation++; cancelAnimationFrame(frame);
      for (const lease of leases.values()) lease.release(); leases.clear(); assets.clear(); images.clear();
      display.width = display.height = 0;
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear); document.removeEventListener("focusin", focus);
    };
  }, []);
  useEffect(() => { commands.current?.teleport(); }, [props.session.zoneId]);
  return <div className="smooth-overworld" ref={root} tabIndex={0} role="group" aria-label="Smooth overworld" data-ready={hud.ready}>
    <div className="overworld-viewport"><canvas ref={canvas} width={384} height={256} aria-hidden="true" onPointerDown={() => root.current?.focus()} />
      <span className="overworld-location">{isZoneId(hud.map) ? zoneById(hud.map).name : hud.map}</span>
      {paused && <div className="overworld-pause"><button className="btn btn-primary" onClick={() => commands.current?.pause()}>Resume exploration</button></div>}
    </div>
    {hud.error && <p role="alert">{hud.error}</p>}
    {!hud.ready && !hud.error && <p role="status">Loading overworld…</p>}
    <div className="overworld-controls">
      <span>WASD / arrows · Shift: run · E / Space: interact · F: Surf · Esc: pause</span>
      <button className="btn" onClick={() => commands.current?.traverse()}>Surf / Land</button>
      <button className="btn" onClick={() => commands.current?.pause()}>Pause</button>
      <label><input type="checkbox" defaultChecked={settings.current.autoSurf} onChange={e => { settings.current.autoSurf = e.target.checked; commands.current?.save(); }} /> Automatic Surf</label>
      <label><input type="checkbox" onChange={e => { settings.current.run = e.target.checked; }} /> Run</label>
    </div>
    <div className="overworld-interactions" aria-label="Nearby Pokémon">
      {hud.near.map(entity => <button key={entity.id} className="btn" disabled={paused} onClick={() => commands.current?.interact(entity.id)}>
        Interact with {entity.name}{props.registeredIds.includes(entity.pokemonId) ? " · Registered" : ""}
      </button>)}
      {!hud.near.length && <span>Approach a visible Pokémon to interact. Exploration does not trigger random encounters.</span>}
    </div>
    <div className="overworld-pad" aria-label="Movement controls">{Object.entries({ Up: [0, -1], Left: [-1, 0], Down: [0, 1], Right: [1, 0] }).map(([label, [x, y]]) => <button key={label} type="button" aria-label={`Walk ${label.toLowerCase()}`}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); root.current?.focus(); commands.current?.press(`touch-${e.pointerId}`, x, y); }}
      onPointerUp={e => commands.current?.release(`touch-${e.pointerId}`)} onPointerCancel={e => commands.current?.release(`touch-${e.pointerId}`)}
      onLostPointerCapture={e => commands.current?.release(`touch-${e.pointerId}`)}>{label}</button>)}</div>
    {debug && <details className="overworld-debug"><summary>Overworld debug</summary><label><input type="checkbox" onChange={e => { settings.current.debug = e.target.checked; }} /> Collision grid</label>
      <output>{hud.map} · {hud.x.toFixed(2)}, {hud.y.toFixed(2)} · {hud.mode} · elevation {hud.elevation} · {hud.fps} FPS · {worldAssets.snapshot.entries} cached maps</output>
      <ul aria-label="Wild Pokémon debug">{hud.visible.map(entity => <li key={entity.id} data-x={entity.position.x.toFixed(3)} data-y={entity.position.y.toFixed(3)} data-id={entity.id}>{entity.name} · {entity.state} · elevation {entity.elevation}</li>)}</ul></details>}
  </div>;
}
