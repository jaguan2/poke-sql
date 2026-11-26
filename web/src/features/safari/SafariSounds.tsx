import { useEffect, useRef, useState } from "react";
import { readLocal, writeLocal } from "../../shared/storage/local";
import type { SafariPhase } from "./types";

const key = "safari-sounds";

export function SafariSounds({ phase }: { phase: SafariPhase }) {
  const [enabled, setEnabled] = useState(() => readLocal(key, false, (value): value is boolean => typeof value === "boolean"));
  const previous = useRef(phase);
  const playing = useRef<HTMLAudioElement>();
  useEffect(() => () => playing.current?.pause(), []);
  useEffect(() => {
    const changed = previous.current !== phase;
    previous.current = phase;
    if (!enabled || !changed || (phase !== "entering" && phase !== "caught")) return;
    const cue = phase === "entering" ? "encounter" : "caught";
    playing.current?.pause();
    const audio = new Audio(`${import.meta.env.BASE_URL}safari/sounds/${cue}.wav`);
    playing.current = audio;
    void audio.play().catch(() => {});
  }, [enabled, phase]);

  return <button type="button" className="btn" aria-pressed={enabled} onClick={() => {
    if (enabled) playing.current?.pause();
    setEnabled(!enabled);
    writeLocal(key, !enabled);
  }}>Sound effects</button>;
}
