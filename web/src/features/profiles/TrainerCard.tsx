import { TRAINERS } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";
import type { TrainerIdentity } from "../../shared/trainer/identity";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import "./TrainerCard.css";

export interface ProfileProgress {
  entries: number; species: number; catches: number;
  challenges: number; challengeTotal: number; types: number; typeTotal: number;
}

const BADGES = [
  { target: 1, shape: "M12 4 19 12 12 20 5 12Z" },
  { target: 2, shape: "M12 3 20 19H4Z" },
  { target: 4, shape: "M8 4h8v4h4v8h-4v4H8v-4H4V8h4Z" },
  { target: 6, shape: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" },
  { target: 8, shape: "M12 20 4 11V6l4-2 4 4 4-4 4 2v5Z" },
  { target: 10, shape: "m5 4 7 3 7-3-1 12-6 5-6-5Z" },
  { target: 12, shape: "m12 3 4 5 5 4-5 4-4 5-4-5-5-4 5-4Z" },
  { target: 15, shape: "M4 6 8 10 12 3 16 10 20 6 18 20H6Z" },
];

interface Props { name: string; trainer: TrainerId; identity: TrainerIdentity; progress: ProfileProgress; ballTheme: string }

export function TrainerCard({ name, trainer, identity, progress, ballTheme }: Props) {
  const model = TRAINERS[trainer];
  return <article className="trainer-card" aria-label="Your trainer card">
    <div className="trainer-card-top"><span>TRAINER CARD</span><img src={`${import.meta.env.BASE_URL}sprites/items/${ballTheme}.png`} alt="" width={32} height={32} /></div>
    <div className="trainer-card-number">ID No. <strong>{identity.id}</strong></div>
    <div className="trainer-card-body">
      <div className="trainer-card-record">
        <div className="trainer-card-name"><span>Name</span><h3>{name.trim() || "Trainer"}</h3></div>
        <dl className="profile-statistics" aria-label="Your progress">
          <div><dt>Pokédex</dt><dd>{progress.entries} / {progress.species}</dd></div>
          <div><dt>SQL catches</dt><dd>{progress.catches}</dd></div>
          <div><dt>Challenges</dt><dd>{progress.challenges} / {progress.challengeTotal}</dd></div>
          <div><dt>Types</dt><dd>{progress.types} / {progress.typeTotal}</dd></div>
        </dl>
      </div>
      <div className="trainer-card-portrait"><TrainerSprite trainer={trainer} pose="portrait" /><span>{model.label}</span><small>{model.region}</small></div>
    </div>
    <div className="trainer-card-issued"><span>Issued</span><time dateTime={identity.issuedAt}>{new Date(identity.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div>
    <progress className="trainer-card-progress" aria-label="Pokédex collection progress" max={progress.species} value={progress.entries} />
    <div className="trainer-card-badges"><span>SQL BADGES</span><ul aria-label="SQL challenge badges">{BADGES.map(({ target, shape }) => <li key={target} data-earned={progress.challenges >= target} aria-label={`${target} SQL challenges: ${progress.challenges >= target ? 'earned' : 'locked'}`} title={`Complete ${target} SQL ${target === 1 ? 'challenge' : 'challenges'}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape} /></svg>
    </li>)}</ul></div>
  </article>;
}
