import { encounterTable, honeyTreeTable, waterSpecies, WEATHER } from "./zones";
import type { SafariSpecies, SafariZoneDefinition, WeatherId } from "./zones";

export function SafariFieldGuide({ zone, registeredIds, weather, previousId, date, shinyOdds, visible = false }: { zone: SafariZoneDefinition; registeredIds: readonly number[]; weather: WeatherId; previousId?: number; date: string; shinyOdds: number; visible?: boolean }) {
  const registered = new Set(registeredIds);
  const found = zone.species.filter(species => registered.has(species.id)).length;
  const { rows } = encounterTable(zone, weather, previousId, date);
  const chances = new Map(rows.map(row => [row.pokemon.id, row.chance]));
  return <aside className="safari-field-guide" aria-label={`${zone.name} encounter pool`}>
    <h3>{visible ? "Grass encounters" : "Encounter table"}</h3><p>{zone.description}</p>
    <p className="safari-weather-note">{WEATHER[weather].icon} {WEATHER[weather].name}. Weather-favored species have twice their usual encounter weight.</p>
    <div className="safari-habitat-progress">
      <span>{found} / {zone.species.length} species registered</span>
      <progress aria-label={`${zone.name} collection progress`} value={found} max={zone.species.length} />
    </div>
    <EncounterPool label={`${zone.name} encounter table`} species={zone.species} registered={registered}
      chances={chances} previousId={previousId} weather={weather} />
    {zone.honeyTree && <details className="safari-honey-pool">
      <summary>Honey Tree encounters</summary>
      <EncounterPool label={`${zone.name} Honey Tree encounter table`} species={zone.honeyTree.species} registered={registered}
        chances={new Map(honeyTreeTable(zone.honeyTree).rows.map(row => [row.pokemon.id, row.chance]))} />
    </details>}
    <small className="safari-guide-note">Register a Pokémon to reveal it here. {visible ? "Approach a visible Pokémon to choose an encounter. Grass appearances include today's weather." : "Walking encounter chances include today's weather. Your last catch rests in the walking pool when other species are available."} Each encounter has a 1 in {shinyOdds} chance to be shiny.</small>
  </aside>;
}

export function WaterFieldGuide({ registeredIds }: { registeredIds: readonly number[] }) {
  const total = waterSpecies.reduce((sum, species) => sum + species.weight, 0);
  return <aside className="safari-field-guide" aria-label="Water encounter pool">
    <h3>Water encounters</h3><p>Approach a visible Pokémon while surfing to interact.</p>
    <EncounterPool label="Water encounter table" species={waterSpecies} registered={new Set(registeredIds)}
      chances={new Map(waterSpecies.map(species => [species.id, species.weight / total]))} />
    <small className="safari-guide-note">Register a Pokémon to reveal it here. These Pokémon can appear in accessible water.</small>
  </aside>;
}

function EncounterPool({ label, species, registered, chances, previousId, weather }: {
  label: string; species: readonly SafariSpecies[]; registered: ReadonlySet<number>; chances: ReadonlyMap<number, number>;
  previousId?: number; weather?: WeatherId;
}) {
  return <table className="safari-pool" aria-label={label}>
      <thead><tr><th scope="col">Pokémon</th><th scope="col">Next roll</th></tr></thead>
      <tbody>{species.map(pokemon => {
        const chance = chances.get(pokemon.id);
        const known = registered.has(pokemon.id);
        const unavailable = pokemon.id === previousId ? "Resting" : "Event only";
        const nextRoll = chance === undefined ? unavailable : `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%`;
        return <tr key={pokemon.id}
        aria-label={known ? `${pokemon.name}: registered` : `Unknown ${pokemon.rarity.toLowerCase()} Pokémon`}
        className={known ? "is-registered" : undefined}>
        <th scope="row"><div className="safari-pool-species"><img className={known ? undefined : "safari-silhouette"} src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={40} height={40} loading="lazy" />
        <span><strong>{known ? pokemon.name : "???"}</strong><small>{pokemon.rarity}</small>
          {chance !== undefined && weather && pokemon.favoredWeather.includes(weather) && <small className="safari-weather-favored">More likely today</small>}
          <small className="safari-registration">{known ? "Registered" : "Not yet found"}</small>
        </span></div></th>
        <td>{nextRoll}</td>
      </tr>;
      })}</tbody>
    </table>;
}
