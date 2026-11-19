import type { CSSProperties } from "react";
import { TRAINERS, TRAINER_THROW, framePosition } from "./profile";
import type { TrainerId } from "./profile";
import "./TrainerSprite.css";

type Props = { trainer: TrainerId; className?: string } & (
  | { pose: "walking"; frame?: number; flipped?: boolean }
  | { pose: "battle"; throwing?: boolean }
  | { pose: "portrait" }
);

export function TrainerSprite(props: Props) {
  const { trainer, pose, className = "" } = props;
  const profile = TRAINERS[trainer];
  const sheet = profile[pose];
  const style: CSSProperties = { backgroundImage: `url('${import.meta.env.BASE_URL}safari/${sheet.file}')`, backgroundSize: `${sheet.columns * 100}% ${sheet.rows * 100}%`, backgroundPosition: framePosition(pose === "battle" ? profile.battle.idleFrame : 0, sheet) };
  if (props.pose === "walking") {
    style.backgroundPosition = framePosition(props.frame ?? 0, sheet);
    style.transform = props.flipped ? "scaleX(-1)" : undefined;
  }
  const positions = Object.fromEntries(profile.battle.throwFrames.map((frame, i) => [`--trainer-pose-${i}`, framePosition(frame, profile.battle)]));
  return <span className={`trainer-sprite trainer-sprite-${pose} ${className}${props.pose === "battle" && props.throwing ? " is-throwing" : ""}`}
    data-trainer={trainer} aria-hidden="true" style={{ ...style, ...positions, "--trainer-throw-duration": `${TRAINER_THROW.durationMs}ms` } as CSSProperties} />;
}
