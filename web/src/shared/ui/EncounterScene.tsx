import { forwardRef } from "react";
import type { ReactNode } from "react";
import geometry from "../pokemon/sprite-bounds.json";
import { TrainerSprite } from "../trainer/TrainerSprite";
import type { TrainerId } from "../trainer/profile";
import "./EncounterScene.css";

type SpriteBounds = typeof geometry["1"];
const spriteBounds: Readonly<Record<string, SpriteBounds>> = geometry;

export const EncounterScene = forwardRef<HTMLDivElement, {
  label: string; titleId: string; terrain: "grass" | "sand" | "cave" | "water";
  identity: { name: string; level: number; badge: string | null; registered?: boolean };
  pokemon: { id: number; label: string } | null;
  trainer: TrainerId; throwing?: boolean; caption: ReactNode; className?: string; children?: ReactNode;
}>(function EncounterScene({ label, titleId, terrain, identity, pokemon, trainer, throwing = false, caption, className = "", children }, ref) {
  const bounds = pokemon ? spriteBounds[pokemon.id] : null;
  // Anchor visible pixels to the platform, preserving small species' sizes and
  // fitting larger species within the native 64x64 battle-sprite envelope.
  const scale = bounds ? Math.min(1, 64 / bounds.width, 64 / bounds.height) : 1;
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
      {identity.badge && <span>{identity.badge}</span>}
      <div className="encounter-hp" aria-hidden="true"><span>HP</span><div className="encounter-hp-track"><i className="encounter-hp-fill" /></div></div>
    </div>
    {pokemon && bounds && <span className="encounter-sprite" role="img" aria-label={pokemon.label}
      style={{ width: `${bounds.width * scale / 240 * 100}%`, height: `${bounds.height * scale / 160 * 100}%` }}>
      <img src={`${import.meta.env.BASE_URL}sprites/${pokemon.id}.png`} alt="" width={bounds.canvasWidth} height={bounds.canvasHeight}
        style={{ width: `${bounds.canvasWidth / bounds.width * 100}%`, height: `${bounds.canvasHeight / bounds.height * 100}%`, left: `${-bounds.left / bounds.width * 100}%`, top: `${-bounds.top / bounds.height * 100}%` }} />
    </span>}
    <TrainerSprite trainer={trainer} pose="battle" throwing={throwing} className="encounter-trainer" />
    <div className="encounter-caption" role="status"><span>{caption}</span></div>
    {children}
  </div>;
});
