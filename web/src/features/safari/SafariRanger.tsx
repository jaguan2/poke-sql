import { useRef } from "react";
import type { CSSProperties } from "react";
import { TrainerSprite } from "../../shared/trainer/TrainerSprite";
import type { TrainerId } from "../../shared/trainer/profile";

export function SafariRanger({ style, active, trainer, sighting }: { style: CSSProperties; active: boolean; trainer: TrainerId; sighting: string }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="safari-ranger-marker" style={style} disabled={!active} aria-label="Talk to Safari Ranger" aria-haspopup="dialog"
      onClick={() => dialogue.current?.showModal()}>
      <TrainerSprite trainer={trainer === "brendan" ? "may" : "brendan"} pose="walking" />
      <span className="safari-ranger-bubble" aria-hidden="true">!</span>
    </button>
    <dialog className="safari-ranger-dialog" ref={dialogue} aria-labelledby="safari-ranger-title">
      <h3 id="safari-ranger-title">Safari Ranger</h3>
      <p>{sighting}</p>
      <form method="dialog"><button className="btn btn-primary">Back to the trail</button></form>
    </dialog>
  </>;
}
