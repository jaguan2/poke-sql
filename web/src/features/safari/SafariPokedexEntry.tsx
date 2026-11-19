import type { PokemonProfile } from "../../shared/pokemon/profile";
import { TypeBadge } from "../../shared/pokemon/TypeBadge";
import catalog from "../../shared/pokemon/pokedex-entries.json";
import "./SafariPokedexEntry.css";

const entries: Readonly<Record<string, typeof catalog.entries["1"]>> = catalog.entries;

export function SafariPokedexEntry({ pokemon }: { pokemon: PokemonProfile }) {
  const entry = entries[pokemon.id];
  return <article className="safari-pokedex-entry" aria-label={`${pokemon.name} Pokédex entry`}>
    <header><span className="safari-entry-light" aria-hidden="true" /><span>Pokédex data registered!</span></header>
    <div className="safari-entry-profile">
      <div className="safari-entry-portrait"><img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt={pokemon.name} width={192} height={192} /></div>
      <div className="safari-entry-identity">
        <h3>{pokemon.name}</h3><p>{entry.category}</p>
        <div className="safari-entry-types"><TypeBadge type={pokemon.type1} />{pokemon.type2 && <TypeBadge type={pokemon.type2} />}</div>
        <dl><div><dt>Height</dt><dd>{pokemon.heightM.toLocaleString()} m</dd></div><div><dt>Weight</dt><dd>{pokemon.weightKg.toLocaleString()} kg</dd></div><div><dt>Generation</dt><dd>{pokemon.generationId}</dd></div></dl>
      </div>
    </div>
    <p className="safari-entry-description">{entry.description}</p>
    <footer>Pokédex description · Pokémon {entry.version}</footer>
  </article>;
}
