import { useEffect, useRef, useState } from "react";
import type { SafariFleeLimit } from "../safari/types";
import { MAX_TRAINER_NAME, TRAINERS, trainerIds } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import ballThemes from "./themes.json";
import "./Profiles.css";

export interface ProfileProgress {
  entries: number; species: number; catches: number;
  challenges: number; challengeTotal: number; types: number; typeTotal: number;
}

interface Props {
  name: string; trainer: TrainerId; progress: ProfileProgress;
  ballTheme: string; autocomplete: boolean; safariFleeAfter: SafariFleeLimit; saveError: boolean;
  onNameChange: (name: string) => void; onTrainerChange: (id: TrainerId) => void;
  onThemeChange: (id: string) => void; onAutocompleteChange: (enabled: boolean) => void;
  onSafariFleeAfterChange: (limit: SafariFleeLimit) => void; onDone: () => void;
}

export function Profiles({ name, trainer, progress, ballTheme, autocomplete, safariFleeAfter, saveError, onNameChange, onTrainerChange, onThemeChange, onAutocompleteChange, onSafariFleeAfterChange, onDone }: Props) {
  const [style, setStyle] = useState<"all" | "boy" | "girl">("all");
  const page = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const model = TRAINERS[trainer];
  useEffect(() => {
    page.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  return <section className="profiles-page" ref={page} aria-labelledby="profiles-title">
    <header className="profiles-heading">
      <div><span className="eyebrow">Your adventure, your way</span><h2 id="profiles-title" ref={heading} tabIndex={-1}>Profiles</h2><p>Your trainer, your collection, your next discovery.</p></div>
      <button className="btn" onClick={onDone}>Done</button>
    </header>
    <div className="profile-identity">
      <article className="trainer-card" aria-label="Your trainer card">
        <div className="trainer-card-top"><span>TRAINER CARD</span><img src={`${import.meta.env.BASE_URL}sprites/items/${ballTheme}.png`} alt="" width={32} height={32} /></div>
        <div className="trainer-card-person"><TrainerSprite trainer={trainer} pose="portrait" /><div><h3>{name.trim() || "Trainer"}</h3><p>{model.label}</p><small>{model.region} · {model.game}</small></div></div>
        <div className="trainer-card-progress"><span>{progress.entries} / {progress.species} Pokédex entries</span><progress aria-label="Pokédex collection progress" max={progress.species} value={progress.entries} /></div>
      </article>
      <section className="profile-name-panel" aria-labelledby="trainer-name-title">
        <h3 id="trainer-name-title">Make it yours</h3>
        <label htmlFor="trainer-name">Trainer name</label>
        <input id="trainer-name" autoComplete="nickname" value={name} maxLength={MAX_TRAINER_NAME} placeholder="Your name" aria-describedby="trainer-name-help" onChange={event => onNameChange(event.target.value)} />
        <p id="trainer-name-help">Up to {MAX_TRAINER_NAME} characters. Your name and appearance save on this device.</p>
        <p>Change your look whenever you like. Your collection and expedition progress stay with you.</p>
      </section>
    </div>
    <dl className="profile-statistics" aria-label="Your progress">
      <div><dt>Pokédex entries</dt><dd>{progress.entries}<small> / {progress.species} species</small></dd></div>
      <div><dt>Safari catches</dt><dd>{progress.catches}<small> successful SQL catches</small></dd></div>
      <div><dt>SQL challenges</dt><dd>{progress.challenges}<small> / {progress.challengeTotal} completed</small></dd></div>
      <div><dt>Types discovered</dt><dd>{progress.types}<small> / {progress.typeTotal} types</small></dd></div>
    </dl>
    <fieldset className="profile-section model-section">
      <legend>Your trainer model</legend>
      <p>{trainerIds.length} familiar faces, with matching walking, battle and throwing sprites.</p>
      <div className="model-filters" role="group" aria-label="Trainer model styles">{([['all', 'All models'], ['boy', 'Boy styles'], ['girl', 'Girl styles']] as const).map(([id, label]) => <button key={id} className="btn" aria-pressed={style === id} onClick={() => setStyle(id)}>{label}</button>)}</div>
      <div className="trainer-options">{trainerIds.filter(id => style === "all" || TRAINERS[id].style === style).map(id => <label className="trainer-option" key={id}>
        <input type="radio" name="trainer" aria-label={TRAINERS[id].label} value={id} checked={trainer === id} onChange={() => onTrainerChange(id)} />
        <TrainerSprite trainer={id} pose="portrait" /><span>{TRAINERS[id].label}</span><small>{TRAINERS[id].game}</small>
      </label>)}</div>
    </fieldset>
    <section className="profile-preferences" aria-label="Profile preferences">
      <fieldset className="profile-section">
        <legend>Poké Ball colors</legend><p>Your colors also choose the ball used for Safari catches.</p>
        <div className="theme-options">{ballThemes.map(theme => <label className="theme-option" key={theme.id}>
          <input type="radio" name="ball-theme" value={theme.id} checked={ballTheme === theme.id} onChange={() => onThemeChange(theme.id)} />
          <img src={`${import.meta.env.BASE_URL}sprites/items/${theme.id}.png`} alt="" width={40} height={40} /><span>{theme.name}</span>
        </label>)}</div>
      </fieldset>
      <section className="profile-section" aria-labelledby="editor-preferences-title">
        <h3 id="editor-preferences-title">Editor assistance</h3>
        <label className="autocomplete-setting"><span><strong>SQL autocomplete</strong><small id="autocomplete-description">Suggest SQL keywords, table and column names, and phrases like LEFT JOIN as you type.</small></span>
          <input type="checkbox" role="switch" aria-label="SQL autocomplete" aria-describedby="autocomplete-description" checked={autocomplete} onChange={event => onAutocompleteChange(event.target.checked)} />
        </label><p>When enabled, use ↑ / ↓ to choose, Enter to accept, and Escape to dismiss. Ctrl+Space opens suggestions.</p>
      </section>
      <section className="profile-section" aria-labelledby="safari-preferences-title">
        <h3 id="safari-preferences-title">Safari encounters</h3>
        <label className="safari-limit-setting" htmlFor="safari-flee-after">Chances before fleeing</label>
        <select id="safari-flee-after" value={safariFleeAfter ?? "unlimited"} aria-describedby="safari-flee-description" onChange={event => onSafariFleeAfterChange(event.target.value === "unlimited" ? null : event.target.value === "5" ? 5 : 8)}>
          <option value="unlimited">Unlimited — relaxed practice</option><option value="5">5 incorrect answers</option><option value="8">8 incorrect answers</option>
        </select><p id="safari-flee-description">Choose a limit to let Pokémon flee. Hints, SQL errors and stopped queries keep your chances. Changes apply to your next encounter; the current encounter keeps its original limit.</p>
      </section>
    </section>
    <p className={saveError ? "notice" : "profile-save-note"} role="status">{saveError ? "This device could not save a profile change. Your changes apply for this session; they may reset when you reopen the app." : "Your profile saves automatically on this device."}</p>
  </section>;
}
