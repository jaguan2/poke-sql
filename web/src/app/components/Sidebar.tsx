import { NAVIGATION } from "../navigation";
import type { NavigationId } from "../navigation";
import { NavigationIcon } from "./NavigationIcon";
import "./Sidebar.css";

interface Props {
  collapsed: boolean; active: NavigationId | null; busy: boolean;
  pokedexCount: number; pcCount: number; completedCount: number; challengeCount: number;
  onNavigate: (destination: NavigationId) => void;
}

export function Sidebar({ collapsed, active, busy, pokedexCount, pcCount, completedCount, challengeCount, onNavigate }: Props) {
  return <aside id="workspace-menu" className={`sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="Workspace menu">
    <div className="sidebar-brand"><img src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`} alt="" width={28} height={28} /><span>PokéSQL</span></div>
    <nav aria-label="Main navigation">{NAVIGATION.map(section => <section className="nav-section" key={section.caption}>
      <h2>{section.caption}</h2>
      {section.items.map(item => <button key={item.id} className="nav-destination" title={item.label} aria-label={item.label} aria-current={active === item.id ? "page" : undefined} aria-pressed={active === item.id} disabled={busy} onClick={() => onNavigate(item.id)}>
        <NavigationIcon name={item.icon} /><span className="nav-label">{item.label}</span>
        {item.id === "pokedex" && <span className="nav-count" aria-hidden="true">{pokedexCount}</span>}
        {item.id === "pc" && <span className="nav-count" aria-hidden="true">{pcCount}</span>}
        {item.id === "challenges" && <span className="nav-count" aria-hidden="true">{completedCount}/{challengeCount}</span>}
      </button>)}
    </section>)}</nav>
  </aside>;
}
