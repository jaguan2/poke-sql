import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Direction } from "./zones";

export const SAFARI_STEP_MS = 110;
const keys: Readonly<Record<string, Direction>> = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };
const typing = (target: EventTarget | null) => target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], audio, video") !== null;
const paused = () => typing(document.activeElement) || document.querySelector("dialog:modal, .safari-area-picker[open], .safari-events[open], .region-map[open]") !== null;

/** Input owns walking cadence; game state still owns collisions and encounters. */
export function useSafariMovement(mapRef: RefObject<HTMLDivElement | null>, active: boolean, onMove: (direction: Direction) => void) {
  const move = useRef(onMove);
  useLayoutEffect(() => { move.current = onMove; }, [onMove]);
  useEffect(() => {
    const map = mapRef.current;
    if (!active || !map) return;
    const held = new Map<string, Direction>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let swipe: { id: number; x: number; y: number; walking: boolean } | null = null;
    const direction = () => [...held.values()].pop();
    const cancel = () => { clearTimeout(timer); held.clear(); swipe = null; };
    const step = () => {
      if (paused()) { cancel(); return; }
      const next = direction();
      if (!next) return;
      move.current(next);
      timer = setTimeout(step, SAFARI_STEP_MS);
    };
    const hold = (key: string, next: Direction) => {
      if (held.get(key) === next) return;
      const previous = direction();
      held.delete(key); held.set(key, next);
      if (next !== previous) { clearTimeout(timer); step(); }
    };
    const release = (key: string) => { held.delete(key); if (!held.size) clearTimeout(timer); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) { cancel(); return; }
      const key = event.key.toLowerCase(), next = keys[key];
      if (!next || event.defaultPrevented || typing(event.target) || paused()) return;
      event.preventDefault();
      if (event.repeat) return;
      map.focus({ preventScroll: true });
      hold(key, next);
    };
    const keyUp = (event: KeyboardEvent) => release(event.key.toLowerCase());
    const pointerDown = (event: PointerEvent) => {
      if (paused() || !event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
      map.focus({ preventScroll: true });
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, walking: false };
      map.setPointerCapture(event.pointerId);
    };
    const swipeDirection = (event: PointerEvent) => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
    };
    const pointerMove = (event: PointerEvent) => {
      const next = swipeDirection(event);
      if (!next || !swipe || paused()) return;
      event.preventDefault(); swipe.walking = true;
      hold("pointer", next);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const next = swipeDirection(event);
      if (!swipe.walking && next && !paused()) move.current(next);
      swipe = null; release("pointer");
    };
    const cancelPointer = () => { swipe = null; release("pointer"); };
    const focus = (event: FocusEvent) => { if (typing(event.target)) cancel(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    document.addEventListener("focusin", focus);
    map.addEventListener("pointerdown", pointerDown); map.addEventListener("pointermove", pointerMove);
    map.addEventListener("pointerup", pointerUp); map.addEventListener("pointercancel", cancelPointer); map.addEventListener("lostpointercapture", cancelPointer);
    return () => {
      cancel();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel);
      document.removeEventListener("focusin", focus);
      map.removeEventListener("pointerdown", pointerDown); map.removeEventListener("pointermove", pointerMove);
      map.removeEventListener("pointerup", pointerUp); map.removeEventListener("pointercancel", cancelPointer); map.removeEventListener("lostpointercapture", cancelPointer);
    };
  }, [active, mapRef]);
}
