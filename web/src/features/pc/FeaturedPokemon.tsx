import { useRef, useState } from "react";
import type { Collection, CollectionCommand } from "./types";
import "./FeaturedPokemon.css";

export function FeaturedPokemon({ collection, busy, error, onCommand, onRetry, onOpenPc }: {
  collection: Collection | null; busy: boolean; error: string;
  onCommand: (command: CollectionCommand) => Promise<boolean>; onRetry: () => Promise<boolean>; onOpenPc: () => void;
}) {
  const picker = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const ids = collection?.featuredIds ?? [];
  const captures = collection?.captures ?? [];
  const matches = captures.filter(capture => `${capture.nickname} ${capture.pokemon.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const reorder = (index: number, offset: number) => {
    const next = [...ids]; [next[index], next[index + offset]] = [next[index + offset], next[index]];
    void onCommand({ type: "featured", ids: next });
  };
  return <section className="featured-pokemon" aria-labelledby="featured-pokemon-title">
    <header><div><h3 id="featured-pokemon-title">Featured Pokémon</h3><p>{ids.length}/6 · Choose Pokémon from your PC to display on your profile.</p></div>
      <div><button className="btn" disabled={busy || !collection || captures.length === 0} onClick={() => picker.current?.showModal()}>Choose Pokémon</button><button className="btn" onClick={onOpenPc}>Open PC Boxes</button></div></header>
    {error && <p className="notice" role="status">{error} <button className="btn" disabled={busy} onClick={() => void onRetry()}>Retry PC save</button></p>}
    <ol className="featured-slots" aria-label="Featured Pokémon lineup">{Array.from({ length: 6 }, (_, index) => {
      const capture = captures.find(item => item.id === ids[index]);
      return <li key={index} className={capture ? "" : "featured-empty"}>{capture ? <>
        <img src={`${import.meta.env.BASE_URL}sprites/${capture.pokemon.id}.png`} alt={capture.pokemon.name} width={96} height={96} />
        <strong>{capture.nickname || capture.pokemon.name}</strong><small>{capture.level === null ? "Imported" : `Lv. ${capture.level}`}</small>
        <div className="featured-slot-actions">
          <button className="btn" disabled={busy || index === 0} aria-label={`Move ${capture.nickname || capture.pokemon.name} left`} onClick={() => reorder(index, -1)}>←</button>
          <button className="btn" disabled={busy || index === ids.length - 1} aria-label={`Move ${capture.nickname || capture.pokemon.name} right`} onClick={() => reorder(index, 1)}>→</button>
          <button className="btn" disabled={busy} aria-label={`Remove ${capture.nickname || capture.pokemon.name} from profile`} onClick={() => void onCommand({ type: "featured", ids: ids.filter(id => id !== capture.id) })}>×</button>
        </div>
      </> : <><img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={36} height={36} /><span>Slot {index + 1}</span></>}</li>;
    })}</ol>
    {!captures.length && <p className="pc-note">Caught Pokémon will appear in PC Boxes and can be featured here.</p>}
    <dialog className="featured-picker" ref={picker} aria-labelledby="featured-picker-title">
      <header><div><h3 id="featured-picker-title">Choose featured Pokémon</h3><p>{ids.length}/6 selected{ids.length === 6 && " · Remove one to choose another."}</p></div><button className="btn" onClick={() => picker.current?.close()}>Done</button></header>
      <label>Find caught Pokémon<input type="search" value={search} placeholder="Species or nickname" onChange={event => { setSearch(event.target.value); setVisibleCount(60); }} /></label>
      <div className="featured-picker-results" role="group" aria-label="Caught Pokémon choices">{matches.slice(0, visibleCount).map(capture => {
        const selected = ids.includes(capture.id);
        return <button key={capture.id} disabled={busy || (!selected && ids.length >= 6)} aria-pressed={selected} onClick={() => void onCommand({ type: "featured", ids: selected ? ids.filter(id => id !== capture.id) : [...ids, capture.id] })}>
          <img src={`${import.meta.env.BASE_URL}sprites/${capture.pokemon.id}.png`} alt="" width={64} height={64} /><strong>{capture.nickname || capture.pokemon.name}</strong>
          <small>{capture.level === null ? "Imported" : `Lv. ${capture.level}`} · {collection?.boxes.find(box => box.id === capture.boxId)?.name} · slot {capture.slot + 1}</small>
        </button>;
      })}</div>
      {matches.length === 0 && <p>No caught Pokémon match this search.</p>}
      {matches.length > visibleCount && <button className="btn" onClick={() => setVisibleCount(count => count + 60)}>Show more</button>}
    </dialog>
  </section>;
}
