import { useState } from "react";
import type { AchievementTrack, CollectionAchievements } from "./achievements";
import "./PokedexAchievements.css";

function AchievementCard({ track }: { track: AchievementTrack }) {
  const earned = track.milestones.filter(milestone => milestone.earned).length;
  const next = track.milestones.find(milestone => !milestone.earned);
  const complete = track.count >= track.total;
  return <article className="achievement-card" data-complete={complete} aria-labelledby={`achievement-${track.id}`}>
    <header><h4 id={`achievement-${track.id}`}>{track.title}</h4><span className="achievement-state">{complete ? '✓ Complete' : `${earned} / ${track.milestones.length} earned`}</span></header>
    <p className="achievement-count"><strong>{track.count.toLocaleString()} / {track.total.toLocaleString()}</strong> collected</p>
    <progress value={track.count} max={track.total} aria-label={`${track.title} progress`} />
    <ul className="achievement-milestones" aria-label={`${track.title} milestones`}>
      {track.milestones.map(milestone => <li key={milestone.target} data-earned={milestone.earned}>
        <span aria-hidden="true">{milestone.earned ? '✓ ' : '◇ '}</span>{milestone.target === track.total ? 'Complete' : milestone.target.toLocaleString()}
        <span className="sr-only"> — collect {milestone.target.toLocaleString()}: {milestone.earned ? 'earned' : 'locked'}</span>
      </li>)}
    </ul>
    <p className="achievement-next">{next ? `${next.target - track.count} more to reach ${next.target.toLocaleString()}.` : 'All milestones earned!'}</p>
  </article>;
}

export function PokedexAchievements({ progress }: { progress: CollectionAchievements }) {
  const [category, setCategory] = useState<'generations' | 'types'>('generations');
  return <section className="pokedex-achievements" aria-labelledby="pokedex-achievements-title">
    <div className="achievements-heading"><h3 id="pokedex-achievements-title">Achievements</h3><span>{progress.earnedCount} / {progress.milestoneCount} milestones earned</span></div>
    <p className="achievements-help">Your whole collection counts, across daily and random mysteries and Safari catches. Every species counts once. Dual-type Pokémon advance both type collections.</p>
    <div className="achievement-overall"><AchievementCard track={progress.overall} /></div>
    <nav className="achievement-categories" aria-label="Achievement categories">
      <button className="btn" aria-pressed={category === 'generations'} onClick={() => setCategory('generations')}>Generations</button>
      <button className="btn" aria-pressed={category === 'types'} onClick={() => setCategory('types')}>Types</button>
    </nav>
    <p className="achievements-help">{category === 'generations' ? 'Species count toward the generation they debuted in, including later evolutions in their own debut generation.' : 'Types use each species’ default form. Fire/Flying counts once toward Fire and once toward Flying.'}</p>
    <div className="achievement-grid" role="region" aria-label={category === 'generations' ? 'Generation achievements' : 'Type achievements'}>
      {progress[category].map(track => <AchievementCard key={track.id} track={track} />)}
    </div>
  </section>;
}
