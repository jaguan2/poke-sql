import { useEffect, useMemo, useRef, useState } from "react";
import { POKEDEX_SPECIES_COUNT } from "../encounters";
import type { PokemonEncounter } from "../encounters";
import { TypeBadge } from "./ResultsTable";
import { collectionAchievements } from "../achievements";
import type { AchievementCatalog } from "../types";
import { PokedexAchievements } from "./PokedexAchievements";
import "./PersonalPokedex.css";

const PAGE_SIZE = 24;

export function PersonalPokedex({ encounters, catalog, saveError, onDaily, onRandom }: {
  encounters: PokemonEncounter[];
  catalog: AchievementCatalog | null;
  saveError: boolean;
  onDaily: () => void;
  onRandom: () => void;
}) {
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState("");
  const [sort, setSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeView, setActiveView] = useState<'collection' | 'achievements'>('collection');
  const achievements = useMemo(() => catalog ? collectionAchievements(encounters, catalog) : null, [encounters, catalog]);
  const view = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    view.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dexNumber = /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : undefined;
    return encounters.filter(entry => {
      const pokemon = entry.pokemon;
      return (!generation || pokemon.generationId === Number(generation))
        && (!term || (dexNumber !== undefined ? pokemon.id === dexNumber : pokemon.name.toLowerCase().includes(term)));
    }).sort((a, b) => sort === "dex" ? a.pokemon.id - b.pokemon.id : sort === "name"
      ? a.pokemon.name.localeCompare(b.pokemon.name)
      : b.firstFoundAt.localeCompare(a.firstFoundAt) || a.pokemon.id - b.pokemon.id);
  }, [encounters, search, generation, sort]);
  const resetFilters = () => { setSearch(""); setGeneration(""); setVisibleCount(PAGE_SIZE); };

  return <section className="personal-pokedex" ref={view} aria-labelledby="personal-pokedex-title">
    <header className="pokedex-heading">
      <span className="eyebrow">Your field journal</span>
      <h2 id="personal-pokedex-title" ref={heading} tabIndex={-1}>My Pokédex</h2>
      <p>Every solved daily or random mystery adds a Pokémon to your collection. Each species gets one entry.</p>
      <div className="pokedex-progress"><strong>{encounters.length} / {POKEDEX_SPECIES_COUNT.toLocaleString()} discovered</strong><span>Saved on this device</span></div>
      <progress value={encounters.length} max={POKEDEX_SPECIES_COUNT} aria-label="Pokédex completion" />
    </header>
    {saveError && <p className="notice" role="status">Your Pokédex is available for this session, but this device could not save it. Keep this window open to retain new discoveries.</p>}
    <nav className="pokedex-view-tabs" aria-label="Pokédex views">
      <button className="btn" aria-pressed={activeView === 'collection'} onClick={() => setActiveView('collection')}>Collection</button>
      <button className="btn" aria-pressed={activeView === 'achievements'} disabled={!achievements} onClick={() => setActiveView('achievements')}>Achievements{achievements && <span>{achievements.earnedCount} earned</span>}</button>
    </nav>
    {activeView === 'achievements' && achievements ? <PokedexAchievements progress={achievements} /> : <>
    {encounters.length === 0 ? <div className="pokedex-empty">
      <img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={72} height={72} />
      <h3>Your first discovery is waiting</h3>
      <p>Solve Who’s That Pokémon? to register the hidden Pokémon here. Daily and random discoveries stay with you as you start new rounds.</p>
      <div className="pokedex-actions"><button className="btn btn-primary" onClick={onDaily}>Play today's mystery</button><button className="btn" onClick={onRandom}>Try random practice</button></div>
    </div> : <>
      <div className="pokedex-filters">
        <div><label htmlFor="pokedex-search">Search discovered Pokémon</label><input id="pokedex-search" type="search" value={search} placeholder="Name or Pokédex number" onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} /></div>
        <div><label htmlFor="pokedex-generation">Generation</label><select id="pokedex-generation" value={generation} onChange={event => { setGeneration(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="">All generations</option>{Array.from({ length: 9 }, (_, index) => <option key={index} value={index + 1}>Generation {index + 1}</option>)}
        </select></div>
        <div><label htmlFor="pokedex-sort">Sort discoveries</label><select id="pokedex-sort" value={sort} onChange={event => { setSort(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="newest">Newest discoveries</option><option value="dex">National Dex number</option><option value="name">Name</option>
        </select></div>
      </div>
      <p className="pokedex-match-count" role="status">{filtered.length} matching Pokémon</p>
      {filtered.length === 0 ? <div className="pokedex-empty"><p>No discoveries match these filters.</p><button className="btn" onClick={resetFilters}>Clear filters</button></div> : <>
        <div className="pokedex-grid">
          {filtered.slice(0, visibleCount).map(entry => {
            const pokemon = entry.pokemon;
            return <article className="encounter-card" aria-labelledby={`encounter-${pokemon.id}`} key={pokemon.id}>
              <div className="encounter-portrait"><span>#{String(pokemon.id).padStart(4, "0")}</span><img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={96} height={96} loading="lazy" /></div>
              <h3 id={`encounter-${pokemon.id}`}>{pokemon.name}</h3>
              <div className="encounter-types"><TypeBadge type={pokemon.type1} />{pokemon.type2 && <TypeBadge type={pokemon.type2} />}</div>
              <dl className="encounter-traits"><div><dt>Generation</dt><dd>{pokemon.generationId}</dd></div><div><dt>Height</dt><dd>{pokemon.heightM.toLocaleString()} m</dd></div><div><dt>Weight</dt><dd>{pokemon.weightKg.toLocaleString()} kg</dd></div></dl>
              <footer><p>Registered <time dateTime={entry.firstFoundAt}>{entry.firstFoundAt.slice(0, 10)}</time> · UTC</p><p>Best solve: {entry.bestGuessCount} guess{entry.bestGuessCount === 1 ? "" : "es"}</p><div className="encounter-sources">{entry.sources.map(source => <span key={source}>{source === "daily" ? "Daily mystery" : "Random practice"}</span>)}</div></footer>
            </article>;
          })}
        </div>
        {visibleCount < filtered.length && <button className="btn pokedex-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show more Pokémon ({filtered.length - visibleCount} remaining)</button>}
      </>}
    </>}
    </>}
  </section>;
}
