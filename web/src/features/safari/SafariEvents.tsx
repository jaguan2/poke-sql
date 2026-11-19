import { useRef } from "react";
import { safariEvents } from "./events";
import { zoneById } from "./zones";
import type { ZoneId } from "./zones";
import "./SafariEvents.css";

export function SafariEvents({ date, disabled, previousId, onZone }: {
  date: string;
  disabled: boolean;
  previousId?: number;
  onZone: (zone: ZoneId) => void;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  const events = safariEvents(date);
  const active = events.filter(event => event.active).length;
  return <details className="safari-events" ref={panel}>
    <summary>Special events <span>{active > 0 ? `${active} active` : "Upcoming visitors"}</span></summary>
    <div className="safari-event-list">{events.map(event => {
      const { visitor } = event;
      const zone = zoneById(visitor.zoneId);
      const resting = event.active && visitor.id === previousId;
      const odds = resting ? "Resting after your last catch" : `${(event.chance * 100).toFixed(2)}% per encounter`;
      return <article className="safari-event" key={visitor.rarity} aria-label={`${visitor.name} ${visitor.rarity} event`}>
        <img src={`${import.meta.env.BASE_URL}sprites/${visitor.id}.png`} alt="" width={64} height={64} />
        <div><h3>{visitor.name} <span>{visitor.rarity}</span></h3>
          <p>{event.active ? "Active now" : "Upcoming"} · {zone.name} · {odds}</p>
          <p><time dateTime={`${event.startsOn}T00:00:00Z`}>{event.startsOn}</time> 00:00 → <time dateTime={`${event.endsOn}T00:00:00Z`}>{event.endsOn}</time> 00:00 UTC</p>
          <button className="btn" disabled={disabled} onClick={() => {
            onZone(visitor.zoneId);
            if (panel.current) panel.current.open = false;
          }}>Explore {zone.name}</button>
        </div>
      </article>;
    })}</div>
    <p className="safari-event-note">Legendary visits run Friday–Sunday. Mythical visits run on days 1–7 of each month. Follow the habitat's encounter table during the event.</p>
  </details>;
}
