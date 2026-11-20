import { useState } from "react";
import type { SafariSession } from "./types";
import type { ZoneId } from "./zones";
import { zoneById } from "./zones";
import { REGIONS, regionById, regionFor, regionPortals, regionalRoute } from "./regions";
import type { RegionId } from "./regions";
import { canTravelTo, visitedLocations } from "./model";
import "./RegionMap.css";

const point = (id: ZoneId) => {
  const route = regionalRoute(id)!;
  return { x: 10 + route.point[0] * .9, y: 5 + route.point[1] * .95 };
};

export function RegionMap({ session, disabled, onTravel, onRegion }: { session: SafariSession; disabled: boolean; onTravel: (id: ZoneId) => void; onRegion: (id: RegionId) => void }) {
  const currentRegion = regionFor(session.zoneId);
  const [regionId, setRegionId] = useState<RegionId>(currentRegion?.id ?? "kanto");
  const [selection, setSelection] = useState<ZoneId>(currentRegion ? session.zoneId : "pallet-town");
  const region = regionById(regionId);
  const visited = visitedLocations(session);
  const selected = zoneById(selection);
  const remote = currentRegion?.id !== regionId;
  const resume = session.regionPositions?.[regionId];
  const currentLandmark = regionalRoute(session.zoneId)?.landmark ?? session.zoneId;
  const landmarks = region.locations.filter(location => regionalRoute(location.id)?.overview !== false);
  const links = region.locations.flatMap(location => regionPortals(location.id).map(portal => [location.id, portal.to] as const))
    .filter(([from, to], index, all) => all.findIndex(([a, b]) => [from, to].sort().join() === [a, b].sort().join()) === index);
  return <details className="region-map">
    <summary><strong>Region map</strong><span>{region.name} · {region.locations.filter(location => visited.includes(location.id)).length} / {region.locations.length} places visited</span></summary>
    <nav className="region-selector" aria-label="Regions">{REGIONS.map(item => <button type="button" key={item.id} aria-pressed={regionId === item.id}
      onClick={() => { setRegionId(item.id); setSelection(currentRegion?.id === item.id ? session.zoneId : session.regionPositions?.[item.id]?.zoneId ?? item.start); }}>{item.name}</button>)}</nav>
    <label className="region-area">Area<select value={selection} onChange={event => setSelection(event.target.value as ZoneId)}>
      {region.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
    </select></label>
    <div className="region-content">
      <div className="region-chart" data-region={regionId} role="group" aria-label={`${region.name} region map`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="region-land" d="M8 4H97V78L78 96H12L6 76 10 53 5 30Z" />
          {links.map(([from, to]) => <line key={`${from}-${to}`} x1={point(from).x} y1={point(from).y} x2={point(to).x} y2={point(to).y} className={visited.includes(from) && visited.includes(to) ? "is-visited" : ""} />)}
        </svg>
        <span className="region-chart-title">{region.name.toUpperCase()}</span>
        {landmarks.map(location => {
          const route = regionalRoute(location.id)!, pos = point(location.id);
          return <button type="button" key={location.id} className={`region-map-place is-${route.kind} ${route.label ? `label-${route.label}` : ""} ${currentLandmark === location.id ? "is-current" : ""}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-label={`View ${location.name}`} aria-current={currentLandmark === location.id ? "location" : undefined} aria-pressed={selection === location.id} onClick={() => setSelection(location.id)}>
            <i aria-hidden="true" /><span>{route.mapName ?? location.name}</span>
          </button>;
        })}
      </div>
      <div className="region-place-details">
        <small>{visited.includes(selection) ? "Visited" : "Unexplored"} · {region.name}</small><h3>{selected.name}</h3><p>{selected.description}</p>
        <div className="region-travel-actions"><button type="button" className="btn btn-primary" disabled={disabled || !canTravelTo(session, selection)} onClick={() => onTravel(selection)}>{session.zoneId === selection ? "You are here" : `Travel to ${selected.name}`}</button>
          {remote && resume && <button type="button" className="btn" disabled={disabled} onClick={() => onRegion(regionId)}>Continue {region.name}</button>}</div>
        {remote && resume && <p>Resume at {zoneById(resume.zoneId).name}. Your position and discoveries are saved.</p>}
        <p className="region-map-help">Choose any area to start there. Traveling never awards a catch. Finish or leave your encounter before traveling.</p>
      </div>
    </div>
  </details>;
}

export function RegionTown({ zoneId, onPc, onPokedex }: { zoneId: ZoneId; onPc: () => void; onPokedex: () => void }) {
  const route = regionalRoute(zoneId)!;
  const exits = [...new Set(regionPortals(zoneId).map(portal => portal.to))];
  return <aside className="region-town" aria-label={`${route.name} guide`}>
    <span className="region-town-icon" aria-hidden="true">⌂</span><h3>{route.kind === "gate" ? "Forest gate" : "Town guide"}</h3>
    <p>{route.description}</p><p>No Pokémon encounters here.</p>
    {route.kind === "town" && <div className="region-town-services"><button type="button" className="btn btn-primary" onClick={onPc}>Open PC Boxes</button><button type="button" className="btn" onClick={onPokedex}>View Pokédex</button></div>}
    <h4>Exits</h4><ul>{exits.map(id => <li key={id}>{zoneById(id).name}</li>)}</ul>
  </aside>;
}
