import { useEffect, useMemo, useRef, useState } from "react";
import { pokemonSprite } from "../../shared/pokemon/sprites";
import { CaptureDetails } from "./CaptureDetails";
import { useBoxDrag } from "./use-box-drag";
import { WALLPAPERS } from "./validation";
import type { Collection, CollectionCommand } from "./types";
import "./PCBoxes.css";

export function PCBoxes({ collection, error, pendingCount, busy, onCommand, onRetry, onSafari, onProfile }: {
  collection: Collection | null; error: string; pendingCount: number; busy: boolean;
  onCommand: (command: CollectionCommand) => Promise<boolean>; onRetry: () => Promise<boolean>;
  onSafari: () => void; onProfile: () => void;
}) {
  const [boxId, setBoxId] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const box = collection?.boxes.find(item => item.id === boxId) ?? collection?.boxes[0];
  const slots = useMemo(() => new Map(collection?.captures.filter(item => item.boxId === box?.id).map(item => [item.slot, item])), [collection, box?.id]);
  const selected = collection?.captures.find(capture => capture.id === selectedId);
  const locked = busy || pendingCount > 0;
  const changeBox = (id: number) => { setBoxId(id); setActiveSlot(0); if (!movingId) setSelectedId(null); };
  const dragging = useBoxDrag(locked, (id, destination, slot) => {
    void onCommand({ type: "move", id, boxId: destination, slot }).then(moved => {
      if (moved) { setSelectedId(id); setActiveSlot(slot); setMovingId(null); }
    });
  }, changeBox);
  const held = useMemo(() => collection?.captures.find(item => item.id === dragging.drag?.id), [collection, dragging.drag?.id]);
  const chooseSlot = async (slot: number) => {
    if (!collection || !box) return;
    if (movingId) {
      if (await onCommand({ type: "move", id: movingId, boxId: box.id, slot })) { setSelectedId(movingId); setMovingId(null); }
    } else setSelectedId(collection.captures.find(capture => capture.boxId === box.id && capture.slot === slot)?.id ?? null);
  };
  const matches = useMemo(() => search.trim() ? collection?.captures.filter(capture => `${capture.nickname} ${capture.pokemon.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [] : [], [collection, search]);
  return <section className="pc-page" aria-labelledby="pc-title">
    <header className="pc-heading"><div><h2 id="pc-title" tabIndex={-1} ref={heading}>PC Boxes</h2>
      <p>{collection ? `${collection.captures.length.toLocaleString()} Pokémon · ${collection.boxes.length} boxes · ${(collection.boxes.length * 30).toLocaleString()} slots` : "Loading caught Pokémon…"}</p></div>
      <button className="btn" onClick={onProfile}>Trainer ID</button></header>
    {(error || pendingCount > 0) && <div className="notice" role="status"><p>{error}{pendingCount > 0 && ` ${pendingCount} caught Pokémon waiting to be saved. Keep this window open if device storage is blocked.`}</p><button className="btn" disabled={busy} onClick={() => void onRetry()}>Retry PC save</button></div>}
    {!collection || !box ? <p className="pc-note">{error ? "Your existing PC data has been kept. Retry to open it." : "Opening PC storage…"}</p> : <>
      {!collection.migrated && <p className="notice">Existing progress could not be read. It will be imported when local storage is available.</p>}
      <div className="pc-toolbar">
        <button className="btn" aria-label="Previous box" data-pc-switch={box.id - 1} disabled={box.id === 1} onClick={() => changeBox(box.id - 1)}>←</button>
        <label className="pc-box-select">Box<select value={box.id} onChange={event => changeBox(Number(event.target.value))}>
          {collection.boxes.map(item => <option key={item.id} value={item.id}>{item.name}{item.id === collection.destinationBoxId ? " · Catch destination" : ""}</option>)}
        </select></label>
        <button className="btn" aria-label="Next box" data-pc-switch={box.id + 1} disabled={box.id === collection.boxes.length} onClick={() => changeBox(box.id + 1)}>→</button>
        <button className="btn" disabled={locked} onClick={() => void onCommand({ type: "add-box" })}>Add box</button>
        <label className="pc-search">Find caught Pokémon<input type="search" value={search} placeholder="Species or nickname" onChange={event => { setSearch(event.target.value); setVisibleCount(60); }} /></label>
      </div>
      <p className="pc-note">Drag a Pokémon to any slot to move or swap it. Hold over a box arrow while dragging to change boxes. You can also select a Pokémon and choose Move.</p>
      <div className="pc-box-settings">
        <form key={`${box.id}:${box.name}`} className="pc-name-form" onSubmit={event => {
          event.preventDefault(); void onCommand({ type: "rename-box", boxId: box.id, name: String(new FormData(event.currentTarget).get("box-name") ?? "") });
        }}><label>Box name<input name="box-name" defaultValue={box.name} maxLength={32} required disabled={locked} /></label><button className="btn" disabled={locked}>Rename box</button></form>
        <label>Background<select value={box.wallpaper} disabled={locked} onChange={event => {
          const wallpaper = WALLPAPERS.find(item => item.id === event.target.value);
          if (wallpaper) void onCommand({ type: "wallpaper", boxId: box.id, wallpaper: wallpaper.id });
        }}>{WALLPAPERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className="btn" disabled={locked || box.id === collection.destinationBoxId} onClick={() => void onCommand({ type: "destination", boxId: box.id })}>{box.id === collection.destinationBoxId ? "Catch destination" : "Send new catches here"}</button>
      </div>
      {movingId && <p className="notice" role="status">Choose a destination slot. Occupied slots will be swapped. <button className="btn" onClick={() => setMovingId(null)}>Cancel move</button></p>}
      <div className="pc-layout">
        <div>{search.trim() ? <section className="pc-search-results" aria-label="Caught Pokémon search results"><h3>{matches.length} matching Pokémon</h3>
          {matches.slice(0, visibleCount).map(capture => <button className="pc-search-result" key={capture.id} onClick={() => {
            changeBox(capture.boxId); if (!movingId) setSelectedId(capture.id); setSearch(""); setActiveSlot(capture.slot);
          }}><img src={pokemonSprite(capture.pokemon.id, capture.shiny)} alt="" width={48} height={48} /><span>{capture.nickname || capture.pokemon.name}<small>{collection.boxes.find(item => item.id === capture.boxId)?.name} · slot {capture.slot + 1}{capture.level !== null && ` · Lv. ${capture.level}`}{capture.shiny && " · ✦ Shiny"}</small></span></button>)}
          {matches.length > visibleCount && <button className="btn" onClick={() => setVisibleCount(count => count + 60)}>Show more</button>}
        </section> : <div className="pc-box" data-wallpaper={box.wallpaper}>
          <div className="pc-box-heading"><h3>{box.name}</h3><span>{slots.size}/30</span></div>
          <div className="pc-grid" role="group" aria-label={`${box.name} slots`}>{Array.from({ length: 30 }, (_, slot) => {
            const capture = slots.get(slot);
            return <button key={slot} ref={element => { cells.current[slot] = element; }} className={`pc-slot${capture ? " is-occupied" : ""}${dragging.drag?.target?.boxId === box.id && dragging.drag.target.slot === slot ? " is-drop-target" : ""}${capture?.id === dragging.drag?.id ? " is-held" : ""}`}
              data-pc-slot={slot} data-pc-box={box.id}
              aria-label={`Slot ${slot + 1}: ${capture ? `${capture.nickname || capture.pokemon.name}${capture.level === null ? "" : `, level ${capture.level}`}${capture.shiny ? ", shiny" : ""}` : "Empty"}`}
              aria-pressed={!!capture && capture.id === selectedId} tabIndex={activeSlot === slot ? 0 : -1} disabled={locked}
              onPointerDown={event => { if (capture && !movingId) dragging.start(event, capture.id); }}
              onPointerMove={dragging.move} onPointerUp={dragging.end} onPointerCancel={dragging.cancel} onLostPointerCapture={dragging.cancel}
              onFocus={() => setActiveSlot(slot)} onClick={event => { if (event.detail > 0 && dragging.consumeClick()) return; void chooseSlot(slot); }} onKeyDown={event => {
                const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 };
                if (event.key in offsets) { event.preventDefault(); const next = Math.max(0, Math.min(29, slot + offsets[event.key])); cells.current[next]?.focus(); }
                if (event.key === "Escape") setMovingId(null);
              }}>
              {capture ? <><img src={pokemonSprite(capture.pokemon.id, capture.shiny)} draggable={false} alt="" width={72} height={72} /><span>{capture.nickname || capture.pokemon.name}</span><small>{capture.level === null ? "Imported" : `Lv. ${capture.level}`}{capture.shiny && " · ✦ Shiny"}{capture.favorite && " ★"}{collection.featuredIds.includes(capture.id) && " · Featured"}</small></> : <span className="pc-empty-slot">{slot + 1}</span>}
            </button>;
          })}</div>
        </div>}</div>
        {selected ? <CaptureDetails capture={selected} collection={collection} busy={locked} moving={movingId === selected.id} onCommand={onCommand}
          onMove={() => { setMovingId(previous => previous === selected.id ? null : selected.id); setSearch(""); }} onProfile={onProfile} />
          : <section className="pc-summary pc-unselected"><h3>{collection.captures.length ? "Select a Pokémon" : "No Pokémon caught yet"}</h3>
            <p>{collection.captures.length ? "View capture details, move Pokémon between boxes or feature them on your Trainer ID." : "Catch a Pokémon in Safari Zone or solve a mystery to add it to your PC."}</p>
            {!collection.captures.length && <button className="btn btn-primary" onClick={onSafari}>Open Safari Zone</button>}</section>}
      </div>
      <p className="pc-note">New catches go to {collection.boxes.find(item => item.id === collection.destinationBoxId)?.name}, then the next available box. More boxes are created when needed.</p>
      {held && dragging.drag && <div className="pc-drag-ghost" style={{ left: dragging.drag.x, top: dragging.drag.y }} aria-hidden="true"><img src={pokemonSprite(held.pokemon.id, held.shiny)} alt="" width={72} height={72} /><span>{held.nickname || held.pokemon.name}</span></div>}
    </>}
  </section>;
}
