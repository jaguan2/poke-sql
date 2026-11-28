import { TRAINERS } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";
import type { TrainerIdentity } from "../../shared/trainer/identity";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import "./TrainerCard.css";

export interface ProfileProgress {
  entries: number; species: number; catches: number;
  challenges: number; challengeTotal: number; types: number; typeTotal: number;
}

const BADGES = [1, 2, 4, 6, 8, 10, 12, 15];

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
    <div className="trainer-card-badges"><span>SQL BADGES</span><ul aria-label="SQL challenge badges">{BADGES.map((target, index) => <li key={target} data-earned={progress.challenges >= target} aria-label={`${target} SQL challenges: ${progress.challenges >= target ? 'earned' : 'locked'}`} title={`Complete ${target} SQL ${target === 1 ? 'challenge' : 'challenges'}`}>
      <img src={`${import.meta.env.BASE_URL}game-ui/badge-${index + 1}.png`} alt="" width={32} height={32} />
    </li>)}</ul></div>
  </article>;
}
