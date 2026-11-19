import { forwardRef } from "react";
import type { ReactNode } from "react";
import geometry from "../pokemon/sprite-bounds.json";
import "./EncounterScene.css";

type SpriteBounds = typeof geometry["1"];
const spriteBounds: Readonly<Record<string, SpriteBounds>> = geometry;

export const EncounterScene = forwardRef<HTMLDivElement, {
  label: string; titleId: string; terrain: "grass" | "sand" | "cave" | "water";
  identity: { name: string; level: number; badge: string | null; registered?: boolean };
  pokemon: { id: number; label: string };
  caption: ReactNode; className?: string; children?: ReactNode;
}>(function EncounterScene({ label, titleId, terrain, identity, pokemon, caption, className = "", children }, ref) {
  const bounds = spriteBounds[pokemon.id];
  // Anchor visible pixels to the platform, preserving small species' sizes and
  // fitting larger species within the native 64x64 battle-sprite envelope.
  const scale = Math.min(1, 64 / bounds.width, 64 / bounds.height);
  return <div className={`encounter-scene ${className}`} ref={ref} role="group" aria-label={label}>
    <img className="encounter-background" src={`${import.meta.env.BASE_URL}safari/battle/${terrain}.png`} alt="" width={240} height={160} />
    <div className="encounter-nameplate">
      <div className="encounter-identity">
        <div className="encounter-name">
          <h3 id={titleId}>{identity.name}</h3>
          {identity.registered && <img className="encounter-registered-ball" src={`${import.meta.env.BASE_URL}sprites/items/poke-ball.png`}
            alt="Already in your Pokédex" title="Already in your Pokédex" width={30} height={30} />}
        </div>
        <small aria-label={`Level ${identity.level}`}>Lv.{identity.level}</small>
      </div>
      {identity.badge && <span>{identity.badge}</span>}<i aria-hidden="true" />
    </div>
    <span className="encounter-sprite" role="img" aria-label={pokemon.label}
      style={{ width: `${bounds.width * scale / 240 * 100}%`, height: `${bounds.height * scale / 160 * 100}%` }}>
      <img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={bounds.canvasWidth} height={bounds.canvasHeight}
        style={{ width: `${bounds.canvasWidth / bounds.width * 100}%`, height: `${bounds.canvasHeight / bounds.height * 100}%`, left: `${-bounds.left / bounds.width * 100}%`, top: `${-bounds.top / bounds.height * 100}%` }} />
    </span>
    <span className="encounter-trainer" aria-hidden="true" />
    <div className="encounter-caption" role="status"><span>{caption}</span></div>
    {children}
  </div>;
});
