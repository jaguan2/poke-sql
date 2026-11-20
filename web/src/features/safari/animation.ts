import type { SafariPhase } from "./types";
import { CAPTURE_DURATION_MS } from "../../shared/ui/encounter-capture";

// Visual phases are transient. Saved encounters retain their settled outcome.
export const SAFARI_TRANSITIONS = {
  roaming: null,
  rustling: { next: "entering", durationMs: 400 },
  entering: { next: "battle", durationMs: 1200 },
  battle: null,
  catching: { next: "caught", durationMs: CAPTURE_DURATION_MS },
  caught: null,
  fled: null,
} satisfies Record<SafariPhase, { next: SafariPhase; durationMs: number } | null>;
