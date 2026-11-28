import type { MouseEvent } from "react";

/** Acknowledges activation, not query correctness. No focus changes or timers. */
export function confirmAction(event: MouseEvent<HTMLElement>) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !(event.target instanceof Element)) return;
  const target = event.target;
  const control = target.closest<HTMLButtonElement>("button")
    ?? (target.matches('input[type="radio"], input[type="checkbox"]') ? target.closest<HTMLElement>("label") ?? target : null);
  if (!(control instanceof HTMLElement) || control.matches(":disabled, [aria-disabled='true']")) return;
  for (const animation of control.getAnimations()) if (animation.id === "action-confirmation") animation.cancel();
  const pulse = control.animate([{ scale: "1" }, { scale: "1.025", offset: 0.4 }, { scale: "1" }], { duration: 220, easing: "ease-out" });
  pulse.id = "action-confirmation";
}
