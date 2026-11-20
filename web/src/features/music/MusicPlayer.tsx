import { useEffect, useRef, useState } from "react";
import { areaTrack, MUSIC_TRACKS as tracks } from "./catalog";
import { readLocal, writeLocal } from "../../shared/storage/local";
import "./MusicPlayer.css";

const musicRegions = [...new Set(tracks.map(track => track.region))];

interface MusicPreferences {
  trackId: string;
  volume: number;
  muted: boolean;
  repeat: boolean;
  followArea?: boolean;
}

function isMusicPreferences(value: unknown): value is MusicPreferences {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<MusicPreferences>;
  return typeof settings.trackId === "string"
    && typeof settings.volume === "number" && Number.isFinite(settings.volume) && settings.volume >= 0 && settings.volume <= 1
    && typeof settings.muted === "boolean" && typeof settings.repeat === "boolean"
    && (settings.followArea === undefined || typeof settings.followArea === "boolean");
}

export function MusicPlayer({ areaMusic }: { areaMusic?: string }) {
  const [preferences, setPreferences] = useState(() => {
    const saved = readLocal("music", {
      trackId: tracks[0].id, volume: 0.25, muted: false, repeat: false, followArea: true,
    }, isMusicPreferences);
    return { ...saved, trackId: tracks.some(track => track.id === saved.trackId) ? saved.trackId : tracks[0].id };
  });
  const [saveError, setSaveError] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const continuePlayback = useRef(false);
  const regional = preferences.followArea !== false ? areaTrack(areaMusic) : undefined;
  const track = regional ?? tracks.find(item => item.id === preferences.trackId)!;

  const updatePreferences = (changes: Partial<MusicPreferences>) => {
    setPreferences(current => ({ ...current, ...changes }));
  };
  useEffect(() => { if (!writeLocal("music", preferences)) setSaveError(true); }, [preferences]);

  useEffect(() => {
    // Restore loudness only. Reloading a workspace never starts its music.
    const player = audio.current!;
    player.volume = preferences.volume;
    player.muted = preferences.muted;
  }, [preferences.volume, preferences.muted]);

  useEffect(() => {
    const player = audio.current!;
    // Read playback before replacing src. Browser-generated pause events during
    // a source change must not be mistaken for a trainer choosing Pause.
    const resume = continuePlayback.current || !player.paused;
    continuePlayback.current = false;
    player.pause();
    player.src = `${import.meta.env.BASE_URL}music/${track.file}`;
    player.load();
    setPlaybackError(false);
    if (!resume) return;
    let cancelled = false;
    void player.play().catch(error => {
      if (!cancelled && error.name !== "AbortError") setPlaybackError(true);
    });
    return () => { cancelled = true; };
  }, [track.id, track.file]);

  const selectTrack = (trackId: string) => {
    audio.current?.pause();
    continuePlayback.current = false;
    setPlaybackError(false);
    updatePreferences({ trackId, followArea: false });
  };

  return <section id="game-music" className="music-player" aria-label="Music player">
    <div className="music-controls">
      <div className="music-heading"><strong>♫ Music</strong><span>{regional ? `${regional.region} area music` : "Pokémon game music"}</span></div>
      <label className="music-track"><span className="sr-only">Music track</span>
        <select value={track.id} onChange={event => selectTrack(event.target.value)}>
          {musicRegions.map(region => <optgroup key={region} label={region}>{tracks.filter(item => item.region === region).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}
        </select>
      </label>
      {/* CORS mode is required for cached media ranges, even on our own origin. */}
      <audio ref={audio} controls crossOrigin="anonymous" loop={!!regional || preferences.repeat} preload="none" aria-label="Music playback"
        onVolumeChange={event => {
          const { volume, muted } = event.currentTarget;
          if (volume !== preferences.volume || muted !== preferences.muted) updatePreferences({ volume, muted });
        }}
        onPlaying={() => setPlaybackError(false)} onError={() => setPlaybackError(true)}
        onEnded={() => {
          if (regional) return;
          continuePlayback.current = true;
          updatePreferences({ trackId: tracks[(tracks.findIndex(item => item.id === track.id) + 1) % tracks.length].id });
        }} />
      <label className="music-repeat"><input type="checkbox" checked={preferences.followArea !== false} onChange={event => updatePreferences({ followArea: event.target.checked })} />Follow area music</label>
      {regional ? <span className="music-repeat">Area theme repeats</span> : <label className="music-repeat"><input type="checkbox" checked={preferences.repeat} onChange={event => updatePreferences({ repeat: event.target.checked })} />Repeat track</label>}
    </div>
    <div className="music-credit"><span>{track.theme}</span><span>{track.artist} · <a href={track.creditUrl} target="_blank" rel="noreferrer">{track.provider}</a></span></div>
    <details className="music-about"><summary>Music credits</summary>
      <p>Press Play once to listen. Follow area music switches and repeats the theme as you explore each region. Pause and mute stay in effect when you travel. Selecting a track pauses playback and switches to the playlist.</p>
      <ul>{tracks.map(item => <li key={item.id}>{item.title} — {item.artist}, {item.provider} (<a href={item.source} target="_blank" rel="noreferrer">source</a>)</li>)}</ul>
      <p>Original game soundtracks by Game Freak. See <a href={`${import.meta.env.BASE_URL}music/CREDITS.txt`} target="_blank" rel="noreferrer">music credits</a> for sources and attribution.</p>
    </details>
    {playbackError && <p className="music-message" role="status">This track could not play. Try another track, or <button type="button" onClick={() => { setPlaybackError(false); audio.current?.load(); }}>reload the audio</button> and press Play.</p>}
    {saveError && <p className="music-message" role="status">Music settings apply for this session; this device could not save them.</p>}
  </section>;
}
