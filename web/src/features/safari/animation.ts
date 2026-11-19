import type { SafariPhase } from "./types";
import { TRAINER_THROW, TRAINERS } from "../../shared/trainer/profile";
import type { TrainerId } from "../../shared/trainer/profile";

export const SAFARI_BALL_ANIMATION_MS = 3200;

export function safariThrowTrajectory(trainer: TrainerId): Record<string, string> {
  const [handX, handY] = TRAINERS[trainer].battle.releasePoint;
  // Native 240x160 scene: trainer canvas begins at (24,48), and the ball's
  // unanimated canvas centre is (176,71.2). Keep the capture point at (176,54.4).
  const start = { x: 24 + handX, y: 48 + handY };
  const end = { x: 176, y: 54.4 };
  const control = { x: (start.x + end.x) / 2, y: -13.6 };
  return Object.fromEntries([0, 0.25, 0.5, 0.75, 1].map((t, i) => {
    const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
    const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
    return [`--safari-flight-${i}`, `${((x - 176) / 240 * 100).toFixed(6)}cqw ${((y - 71.2) / 240 * 100).toFixed(6)}cqw`];
  }));
}

// Visual phases are transient. Saved encounters retain their settled outcome.
export const SAFARI_TRANSITIONS = {
  roaming: null,
  rustling: { next: "entering", durationMs: 400 },
  entering: { next: "battle", durationMs: 1200 },
  battle: null,
  catching: { next: "caught", durationMs: TRAINER_THROW.releaseDelayMs + SAFARI_BALL_ANIMATION_MS },
  caught: null,
  fled: null,
} satisfies Record<SafariPhase, { next: SafariPhase; durationMs: number } | null>;
