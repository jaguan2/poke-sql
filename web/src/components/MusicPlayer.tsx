import { useEffect, useRef, useState } from "react";
import tracks from "../music-tracks.json";
import { readLocal, writeLocal } from "../storage";
import "./MusicPlayer.css";

interface MusicPreferences {
  trackId: string;
  volume: number;
  muted: boolean;
  repeat: boolean;
}

function isMusicPreferences(value: unknown): value is MusicPreferences {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<MusicPreferences>;
  return tracks.some(track => track.id === settings.trackId)
    && typeof settings.volume === "number" && Number.isFinite(settings.volume) && settings.volume >= 0 && settings.volume <= 1
    && typeof settings.muted === "boolean" && typeof settings.repeat === "boolean";
}

export function MusicPlayer() {
  const [preferences, setPreferences] = useState(() => readLocal("music", {
    trackId: tracks[0].id, volume: 0.25, muted: false, repeat: false,
  }, isMusicPreferences));
  const [saveError, setSaveError] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const continuePlayback = useRef(false);
  const track = tracks.find(item => item.id === preferences.trackId)!;

  const updatePreferences = (changes: Partial<MusicPreferences>) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    if (!writeLocal("music", next)) setSaveError(true);
  };

  useEffect(() => {
    // Restore loudness only. Reloading a workspace never starts its music.
    const player = audio.current!;
    player.volume = preferences.volume;
    player.muted = preferences.muted;
  }, [preferences.volume, preferences.muted]);

  useEffect(() => {
    if (!continuePlayback.current) return;
    continuePlayback.current = false;
    const player = audio.current!;
    void player.play().catch(error => {
      // A subsequent pause or track change can legitimately abort play().
      if (error.name !== "AbortError") setPlaybackError(true);
    });
  }, [track.id]);

  const selectTrack = (trackId: string, play = false) => {
    audio.current?.pause();
    continuePlayback.current = play;
    setPlaybackError(false);
    updatePreferences({ trackId });
  };

  return <section className="music-player" aria-label="Poké Radio">
    <div className="music-controls">
      <div className="music-heading"><strong>♫ Poké Radio</strong><span>Offline Pokémon arrangements</span></div>
      <label className="music-track"><span className="sr-only">Music track</span>
        <select value={track.id} onChange={event => selectTrack(event.target.value)}>
          {tracks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <audio ref={audio} controls loop={preferences.repeat} preload="none" aria-label="Music playback"
        src={`${import.meta.env.BASE_URL}music/${track.file}`}
        onVolumeChange={event => updatePreferences({ volume: event.currentTarget.volume, muted: event.currentTarget.muted })}
        onPlaying={() => setPlaybackError(false)} onError={() => setPlaybackError(true)}
        onEnded={() => selectTrack(tracks[(tracks.findIndex(item => item.id === track.id) + 1) % tracks.length].id, true)} />
      <label className="music-repeat"><input type="checkbox" checked={preferences.repeat} onChange={event => updatePreferences({ repeat: event.target.checked })} />Repeat track</label>
    </div>
    <div className="music-credit"><span>{track.theme}</span><span>{track.artist} · <a href="https://ocremix.org" target="_blank" rel="noreferrer">OverClocked ReMix</a></span></div>
    <details className="music-about"><summary>Music credits &amp; use</summary>
      <p>The playlist advances automatically and returns to the first track. Selecting a track pauses playback; press Play when you are ready.</p>
      <ul>{tracks.map(item => <li key={item.id}>{item.title} — {item.artist}, OverClocked ReMix ({item.source})</li>)}</ul>
      <p>Original Pokémon Diamond music: Go Ichinose, Hitomi Sato, Junichi Masuda, and Morikazu Aoki. Snowflakes in Her Hair was originally credited to Blue Magic (now NoTuX).</p>
      <p>Unmodified MP3s are bundled under the <a href="https://ocremix.org/info/Content_Policy" target="_blank" rel="noreferrer">OC ReMix content policy</a>: noncommercial redistribution with attribution. Recordings and compositions belong to their respective owners. No affiliation or endorsement is implied.</p>
    </details>
    {playbackError && <p className="music-message" role="status">This track could not play. Try another track, or <button type="button" onClick={() => { setPlaybackError(false); audio.current?.load(); }}>reload the audio</button> and press Play.</p>}
    {saveError && <p className="music-message" role="status">Music settings apply for this session; this device could not save them.</p>}
  </section>;
}
