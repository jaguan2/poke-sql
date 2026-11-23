import type { PokemonProfile } from "../../shared/pokemon/profile";
import { TypeBadge } from "../../shared/pokemon/TypeBadge";
import type { PokemonEncounter } from "./encounters";

export function PokedexCard({ pokemon, seen, owned, entry, expanded }: {
  pokemon: PokemonProfile; seen: boolean; owned: boolean; entry?: PokemonEncounter; expanded: boolean;
}) {
  return <article className={`encounter-card pokedex-slot is-${owned ? "owned" : seen ? "seen" : "unseen"}`} aria-labelledby={seen ? `encounter-${pokemon.id}` : undefined} aria-label={seen ? undefined : `Unseen Pokémon #${String(pokemon.id).padStart(4, "0")}`}>
    <div className="encounter-art"><span>#{String(pokemon.id).padStart(4, "0")}</span>
      {owned && <img className="pokedex-owned-ball" src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} alt="Owned" width={16} height={16} />}
      <img className="pokedex-species-sprite" src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt={seen ? pokemon.name : "Unseen Pokémon silhouette"} width={96} height={96} loading="lazy" />
    </div>
    <h3 id={`encounter-${pokemon.id}`}>{seen ? pokemon.name : "???"}</h3>
    <p className="pokedex-entry-status">{owned ? "Owned" : seen ? "Seen" : "Unseen"}</p>
    {seen && <details className="pokedex-entry-details" open={expanded}><summary>Entry</summary>
      <div className="encounter-types"><TypeBadge type={pokemon.type1} />{pokemon.type2 && <TypeBadge type={pokemon.type2} />}</div>
      <dl className="encounter-traits"><div><dt>Generation</dt><dd>{pokemon.generationId}</dd></div><div><dt>Height</dt><dd>{pokemon.heightM.toLocaleString()} m</dd></div><div><dt>Weight</dt><dd>{pokemon.weightKg.toLocaleString()} kg</dd></div></dl>
      {entry && <footer><p>Registered <time dateTime={entry.firstFoundAt}>{entry.firstFoundAt.slice(0, 10)}</time> · UTC</p>
        <p>Best solve: {entry.bestGuessCount} {entry.sources.includes("safari") ? entry.bestGuessCount === 1 ? "attempt" : "attempts" : entry.bestGuessCount === 1 ? "guess" : "guesses"}</p>
        <div className="encounter-sources">{entry.sources.map(source => <span key={source}>{source === "daily" ? "Daily mystery" : source === "safari" ? "Safari Zone" : "Random practice"}</span>)}</div>
      </footer>}
    </details>}
  </article>;
}
