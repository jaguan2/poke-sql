import { useEffect, useMemo, useRef, useState } from "react";
import { POKEDEX_SPECIES_COUNT, type PokemonEncounter } from "./encounters";
import { collectionAchievements } from "./achievements";
import type { AchievementCatalog } from "./types";
import { PokedexAchievements } from "./PokedexAchievements";
import { PokedexCard } from "./PokedexCard";
import "./PersonalPokedex.css";

const PAGE_SIZE = 24;
export type PokedexView = "collection" | "achievements";

export function PersonalPokedex({ encounters, catalog, seenIds, ownedIds, saveError, recovered, onDaily, onRandom, onSafari, activeView, onViewChange }: {
  encounters: PokemonEncounter[]; catalog: AchievementCatalog | null; seenIds: readonly number[]; ownedIds: readonly number[];
  saveError: boolean; recovered: boolean; onDaily: () => void; onRandom: () => void; onSafari: () => void;
  activeView: PokedexView; onViewChange: (view: PokedexView) => void;
}) {
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("dex");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const achievements = useMemo(() => catalog ? collectionAchievements(encounters, catalog) : null, [encounters, catalog]);
  const seen = useMemo(() => new Set([...seenIds, ...ownedIds]), [seenIds, ownedIds]);
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);
  const entries = useMemo(() => new Map(encounters.map(entry => [entry.pokemon.id, entry])), [encounters]);
  const view = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { view.current?.scrollIntoView({ block: "start" }); heading.current?.focus({ preventScroll: true }); }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const number = /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : undefined;
    return (catalog?.pokemon ?? []).filter(pokemon =>
      (!generation || pokemon.generationId === Number(generation))
      && (status === "all" || (status === "owned" ? owned.has(pokemon.id) : status === "seen" ? seen.has(pokemon.id) : !seen.has(pokemon.id)))
      && (!term || (number !== undefined ? pokemon.id === number : seen.has(pokemon.id) && pokemon.name.toLowerCase().includes(term)))
    ).sort((a, b) => sort === "name" ? (seen.has(a.id) ? a.name : "zzz").localeCompare(seen.has(b.id) ? b.name : "zzz") || a.id - b.id
      : sort === "newest" ? (entries.get(b.id)?.firstFoundAt ?? "").localeCompare(entries.get(a.id)?.firstFoundAt ?? "") || a.id - b.id : a.id - b.id);
  }, [catalog, entries, search, generation, status, sort, seen, owned]);
  const resetFilters = () => { setSearch(""); setGeneration(""); setStatus("all"); setVisibleCount(PAGE_SIZE); };

  return <section className="personal-pokedex" ref={view} aria-labelledby="personal-pokedex-title">
    <header className="pokedex-heading"><h2 id="personal-pokedex-title" ref={heading} tabIndex={-1}>My Pokédex</h2>
      <p>Encounter Pokémon to reveal their entries. Catch them to add them to your PC.</p>
      <div className="pokedex-progress"><strong>{seen.size} seen</strong><strong>{owned.size} owned</strong><span>{POKEDEX_SPECIES_COUNT.toLocaleString()} Pokémon · National Dex</span></div>
      <progress value={owned.size} max={POKEDEX_SPECIES_COUNT} aria-label="Pokédex completion" />
    </header>
    {saveError && <p className="notice" role="status">This device could not save your Pokédex. Keep this window open to retain new discoveries.</p>}
    {recovered && <p className="notice" role="status">Some saved discoveries could not be read. Valid entries were recovered and your previous save was preserved.</p>}
    <nav className="pokedex-view-tabs" aria-label="Pokédex views">
      <button className="btn" aria-pressed={activeView === "collection"} onClick={() => onViewChange("collection")}>Pokédex</button>
      <button className="btn" aria-pressed={activeView === "achievements"} disabled={!achievements} onClick={() => onViewChange("achievements")}>Achievements{achievements && <span>{achievements.earnedCount} earned</span>}</button>
      <button className="btn" onClick={onSafari}>Explore Safari Zone</button><button className="btn" onClick={onDaily}>Daily mystery</button><button className="btn" onClick={onRandom}>Random practice</button>
    </nav>
    {activeView === "achievements" && achievements ? <PokedexAchievements progress={achievements} /> : <div className="pokedex-screen">
      <div className="pokedex-screen-heading"><strong>National Pokédex</strong><span>Showing {Math.min(visibleCount, filtered.length)} of {filtered.length.toLocaleString()}</span></div>
      <div className="pokedex-filters">
        <div><label htmlFor="pokedex-search">Search Pokédex</label><input id="pokedex-search" type="search" value={search} placeholder="Number or a seen Pokémon's name" onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} /></div>
        <div><label htmlFor="pokedex-generation">Region</label><select id="pokedex-generation" title="Region where the species was introduced" value={generation} onChange={event => { setGeneration(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="">All regions</option>{catalog?.generations.map(item => <option key={item.id} value={item.id}>{item.region} · Gen {item.id}</option>)}
        </select></div>
        <div><label htmlFor="pokedex-status">Status</label><select id="pokedex-status" value={status} onChange={event => { setStatus(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="all">All Pokémon</option><option value="owned">Owned</option><option value="seen">Seen</option><option value="unseen">Unseen</option>
        </select></div>
        <div><label htmlFor="pokedex-sort">Sort Pokémon</label><select id="pokedex-sort" value={sort} onChange={event => { setSort(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="dex">National Dex number</option><option value="newest">Newest discoveries</option><option value="name">Name</option>
        </select></div>
      </div>
      <p className="pokedex-match-count" role="status">{filtered.length.toLocaleString()} matching Pokémon</p>
      {filtered.length === 0 ? <div className="pokedex-empty"><p>{status === "owned" && owned.size === 0 ? "No Pokémon owned yet" : "No Pokémon match these filters."}</p><button className="btn" onClick={resetFilters}>Clear filters</button></div> : <>
        <div className="pokedex-grid">{filtered.slice(0, visibleCount).map(pokemon => <PokedexCard key={pokemon.id} pokemon={pokemon} seen={seen.has(pokemon.id)} owned={owned.has(pokemon.id)} entry={entries.get(pokemon.id)} expanded={status === "owned"} />)}</div>
        {visibleCount < filtered.length && <button className="btn pokedex-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show more Pokémon ({filtered.length - visibleCount} remaining)</button>}
      </>}
    </div>}
  </section>;
}
