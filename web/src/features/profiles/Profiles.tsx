import { useState } from "react";
import type { TrainerIdentity } from "../../shared/trainer/identity";
import { MAX_TRAINER_NAME, TRAINERS, trainerIds } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import { PersonalizationPage } from "./PersonalizationPage";
import { TrainerCard } from "./TrainerCard";
import type { ProfileProgress } from "./TrainerCard";

interface Props {
  name: string; trainer: TrainerId; identity: TrainerIdentity; progress: ProfileProgress;
  ballTheme: string; saveError: boolean;
  onNameChange: (name: string) => void; onTrainerChange: (id: TrainerId) => void;
  onDone: () => void;
}

export function Profiles({ name, trainer, identity, progress, ballTheme, saveError, onNameChange, onTrainerChange, onDone }: Props) {
  const [style, setStyle] = useState<"all" | "boy" | "girl">("all");
  return <PersonalizationPage title="Trainer ID" description="Your trainer, your collection, your next discovery." saveError={saveError} onDone={onDone}>
    <div className="profile-identity">
      <TrainerCard name={name} trainer={trainer} identity={identity} progress={progress} ballTheme={ballTheme} />
      <section className="profile-name-panel" aria-labelledby="trainer-name-title">
        <h3 id="trainer-name-title">Make it yours</h3>
        <label htmlFor="trainer-name">Trainer name</label>
        <input id="trainer-name" autoComplete="nickname" value={name} maxLength={MAX_TRAINER_NAME} placeholder="Your name" aria-describedby="trainer-name-help" onChange={event => onNameChange(event.target.value)} />
        <p id="trainer-name-help">Up to {MAX_TRAINER_NAME} characters. Your name and appearance save on this device.</p>
        <p>Change your look whenever you like. Your collection and expedition progress stay with you.</p>
      </section>
    </div>
    <fieldset className="profile-section model-section">
      <legend>Your trainer model</legend>
      <p>{trainerIds.length} familiar faces, with matching walking, battle and throwing sprites.</p>
      <div className="model-filters" role="group" aria-label="Trainer model styles">{([['all', 'All models'], ['boy', 'Boy styles'], ['girl', 'Girl styles']] as const).map(([id, label]) => <button key={id} className="btn" aria-pressed={style === id} onClick={() => setStyle(id)}>{label}</button>)}</div>
      <div className="trainer-options">{trainerIds.filter(id => style === "all" || TRAINERS[id].style === style).map(id => <label className="trainer-option" key={id}>
        <input type="radio" name="trainer" aria-label={TRAINERS[id].label} value={id} checked={trainer === id} onChange={() => onTrainerChange(id)} />
        <TrainerSprite trainer={id} pose="portrait" /><span>{TRAINERS[id].label}</span><small>{TRAINERS[id].game}</small>
      </label>)}</div>
    </fieldset>
  </PersonalizationPage>;
}
