import { useState, type CSSProperties } from "react";
import type { SafariSession } from "./types";
import type { ZoneId } from "./zones";
import { zoneById } from "./zones";
import { REGIONS, regionById, regionFor, regionPortals, regionalRoute } from "./regions";
import type { RegionId } from "./regions";
import { canTravelTo, visitedLocations } from "./model";
import overviews from "./region-overviews.json" with { type: "json" };
import sinnohOverview from "./sinnoh-overview.json" with { type: "json" };
import "./RegionMap.css";

interface RegionOverview { file: string; game: string; width: number; height: number; points: Record<string, { x: number; y: number }>; markers: readonly string[] }
const regionMaps: Record<RegionId, RegionOverview> = { ...overviews, sinnoh: sinnohOverview };

export function RegionMap({ session, disabled, onTravel, onRegion }: { session: SafariSession; disabled: boolean; onTravel: (id: ZoneId) => void; onRegion: (id: RegionId) => void }) {
  const currentRegion = regionFor(session.zoneId);
  const [regionId, setRegionId] = useState<RegionId>(currentRegion?.id ?? "kanto");
  const [selection, setSelection] = useState<ZoneId>(currentRegion ? session.zoneId : "pallet-town");
  const region = regionById(regionId);
  const visited = visitedLocations(session);
  const selected = zoneById(selection);
  const remote = currentRegion?.id !== regionId;
  const resume = session.regionPositions?.[regionId];
  const overview = regionMaps[regionId];
  const landmarks = region.locations.filter(location => overview.markers.includes(location.id));
  const point = (id: ZoneId) => ({ left: `${overview.points[id].x / overview.width * 100}%`, top: `${overview.points[id].y / overview.height * 100}%` });
  return <details className="region-map">
    <summary><strong>Region map</strong><span>{region.name} · {region.locations.filter(location => visited.includes(location.id)).length} / {region.locations.length} places visited</span></summary>
    <nav className="region-selector" aria-label="Regions">{REGIONS.map(item => <button type="button" key={item.id} aria-pressed={regionId === item.id}
      onClick={() => { setRegionId(item.id); setSelection(currentRegion?.id === item.id ? session.zoneId : session.regionPositions?.[item.id]?.zoneId ?? item.start); }}>{item.name}</button>)}</nav>
    <label className="region-area">Area<select aria-label="Area" value={selection} onChange={event => setSelection(event.target.value as ZoneId)}>
      {region.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
    </select></label>
    <div className="region-content">
      <div className="region-chart" data-region={regionId} role="group" aria-label={`${region.name} region map`}>
        <div className="region-map-viewport" style={{ "--atlas-width": overview.width, "--atlas-height": overview.height } as CSSProperties}>
          <img className="region-map-art" src={`${import.meta.env.BASE_URL}safari/${overview.file}`} alt={`${region.name} town map from ${overview.game}`} width={overview.width} height={overview.height} draggable={false} />
          {landmarks.map(location => <button type="button" key={location.id} className={`region-map-place${overview.points[location.id].x < overview.width * .25 ? " tooltip-start" : overview.points[location.id].x > overview.width * .75 ? " tooltip-end" : ""}${visited.includes(location.id) ? " is-visited" : ""}`}
            style={point(location.id)} aria-label={`View ${location.name}`} aria-current={session.zoneId === location.id ? "location" : undefined} aria-pressed={selection === location.id} onClick={() => setSelection(location.id)}>
            <i aria-hidden="true" /><span aria-hidden="true">{location.name}</span>
          </button>)}
          {currentRegion?.id === regionId && <span className="region-current-position" style={point(session.zoneId)} role="img" aria-label={`Your position: ${zoneById(session.zoneId).name}`} />}
          <span className="region-map-cursor" style={point(selection)} aria-hidden="true" />
        </div>
        <div className="region-map-caption"><strong>{selected.name}</strong><span>{overview.game}</span></div>
      </div>
      <div className="region-place-details">
        <small>{visited.includes(selection) ? "Visited" : "Unexplored"} · {region.name}</small><h3>{selected.name}</h3><p>{selected.description}</p>
        {selected.honeyTree && <p>◆ Honey Tree</p>}
        <div className="region-travel-actions"><button type="button" className="btn btn-primary" disabled={disabled || !canTravelTo(session, selection)} onClick={() => onTravel(selection)}>{session.zoneId === selection ? "You are here" : `Travel to ${selected.name}`}</button>
          {remote && resume && <button type="button" className="btn" disabled={disabled} onClick={() => onRegion(regionId)}>Continue {region.name}</button>}</div>
        {remote && resume && <p>Resume at {zoneById(resume.zoneId).name}. Your position and discoveries are saved.</p>}
        <p className="region-map-help">Choose a marked location or use Area. Gates and cave floors are in the list. Finish or leave your encounter before traveling.</p>
      </div>
    </div>
  </details>;
}

export function RegionTown({ zoneId, smooth = false, onPc, onPokedex }: { zoneId: ZoneId; smooth?: boolean; onPc: () => void; onPokedex: () => void }) {
  const route = regionalRoute(zoneId)!;
  const exits = [...new Set(regionPortals(zoneId).map(portal => portal.to))];
  return <aside className="region-town" aria-label={`${route.name} guide`}>
    <span className="region-town-icon" aria-hidden="true">⌂</span><h3>{route.kind === "gate" ? "Forest gate" : "Town guide"}</h3>
    <p>{route.description}</p><p>{smooth ? "No land encounters here. Pokémon may appear in accessible water while surfing." : "No Pokémon encounters here."}</p>
    {route.kind === "town" && <div className="region-town-services"><button type="button" className="btn btn-primary" onClick={onPc}>Open PC Boxes</button><button type="button" className="btn" onClick={onPokedex}>View Pokédex</button></div>}
    <h4>Exits</h4><ul>{exits.map(id => <li key={id}>{zoneById(id).name}</li>)}</ul>
  </aside>;
}
