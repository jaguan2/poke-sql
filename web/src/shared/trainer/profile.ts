import profiles from "./profiles.json" with { type: "json" };

export const TRAINERS = profiles;
export type TrainerId = keyof typeof profiles;
export function isTrainerId(value: unknown): value is TrainerId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(profiles, value);
}
export const trainerIds = Object.keys(profiles).filter(isTrainerId);

// Red/Leaf's 20/6/6/24/1-tick tempo, shared by all model-specific pose sequences.
// Release the ball as the forward throwing pose (the third pose) begins.
export const TRAINER_THROW = { releaseDelayMs: 26 / 60 * 1000, durationMs: 57 / 60 * 1000 };

export function framePosition(frame: number, sheet: { columns: number; rows: number }): string {
  const x = sheet.columns === 1 ? 0 : frame % sheet.columns / (sheet.columns - 1) * 100;
  const y = sheet.rows === 1 ? 0 : Math.floor(frame / sheet.columns) / (sheet.rows - 1) * 100;
  return `${x}% ${y}%`;
}

export const MAX_TRAINER_NAME = 24;
export const isTrainerName = (value: unknown): value is string => typeof value === "string" && value.length <= MAX_TRAINER_NAME;
