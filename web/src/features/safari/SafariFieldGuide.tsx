import { encounterTable, WEATHER } from "./zones";
import type { SafariZoneDefinition, WeatherId } from "./zones";

export function SafariFieldGuide({ zone, registeredIds, weather, previousId, date }: { zone: SafariZoneDefinition; registeredIds: readonly number[]; weather: WeatherId; previousId?: number; date: string }) {
  const registered = new Set(registeredIds);
  const found = zone.species.filter(species => registered.has(species.id)).length;
  const { rows } = encounterTable(zone, weather, previousId, date);
  const chances = new Map(rows.map(row => [row.pokemon.id, row.chance]));
  return <aside className="safari-field-guide" aria-label={`${zone.name} encounter pool`}>
    <h3>Encounter table</h3><p>{zone.description}</p>
    <p className="safari-weather-note">{WEATHER[weather].icon} {WEATHER[weather].name}. Weather-favored species have twice their usual encounter weight.</p>
    <div className="safari-habitat-progress">
      <span>{found} / {zone.species.length} species registered</span>
      <progress aria-label={`${zone.name} collection progress`} value={found} max={zone.species.length} />
    </div>
    <table className="safari-pool" aria-label={`${zone.name} encounter table`}>
      <thead><tr><th scope="col">Pokémon</th><th scope="col">Next roll</th></tr></thead>
      <tbody>{zone.species.map(pokemon => {
        const chance = chances.get(pokemon.id);
        const unavailable = pokemon.id === previousId ? "Resting" : "Event only";
        const nextRoll = chance === undefined ? unavailable : `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%`;
        return <tr key={pokemon.id}
        aria-label={`${pokemon.name}: ${registered.has(pokemon.id) ? "registered" : "not yet found"}`}
        className={registered.has(pokemon.id) ? "is-registered" : undefined}>
        <th scope="row"><div className="safari-pool-species"><img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={40} height={40} loading="lazy" />
        <span><strong>{pokemon.name}</strong><small>{pokemon.rarity}</small>
          {chance !== undefined && pokemon.favoredWeather.includes(weather) && <small className="safari-weather-favored">More likely today</small>}
          <small className="safari-registration">{registered.has(pokemon.id) ? "Registered" : "Not yet found"}</small>
        </span></div></th>
        <td>{nextRoll}</td>
      </tr>;
      })}</tbody>
    </table>
    <small className="safari-guide-note">Wild encounters roll from this table. Chances include today's weather; your last catch rests so you meet a different Pokémon. Each species counts once in your Pokédex.</small>
  </aside>;
}
