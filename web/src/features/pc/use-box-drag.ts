import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

interface Gesture { id: string; pointerId: number; x: number; y: number; active: boolean }
interface DropSlot { boxId: number; slot: number }

function slotAt(x: number, y: number): DropSlot | null {
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-pc-slot]");
  return target ? { boxId: Number(target.dataset.pcBox), slot: Number(target.dataset.pcSlot) } : null;
}

export function useBoxDrag(locked: boolean, onDrop: (id: string, boxId: number, slot: number) => void, onBox: (id: number) => void) {
  const gesture = useRef<Gesture | null>(null);
  const switched = useRef<number | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipClick = useRef(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; target: DropSlot | null } | null>(null);
  const cancel = useCallback(() => {
    gesture.current = null; clearTimeout(hoverTimer.current); switched.current = null; setDrag(null);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", escape); window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancel); clearTimeout(hoverTimer.current); };
  }, [cancel]);
  useEffect(() => { if (locked) cancel(); }, [locked, cancel]);
  return { drag,
    consumeClick: () => { const skip = skipClick.current; skipClick.current = false; return skip; },
    start: (event: PointerEvent<HTMLButtonElement>, id: string) => {
      if (locked || event.button !== 0) return;
      skipClick.current = false;
      gesture.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    move: (event: PointerEvent<HTMLButtonElement>) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
      current.active = true; event.preventDefault();
      setDrag({ id: current.id, x: event.clientX, y: event.clientY, target: slotAt(event.clientX, event.clientY) });
      const control = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-pc-switch]:not(:disabled)");
      const box = control ? Number(control.dataset.pcSwitch) : null;
      if (box !== switched.current) {
        clearTimeout(hoverTimer.current); switched.current = box;
        if (box !== null) hoverTimer.current = setTimeout(() => onBox(box), 500);
      }
    },
    end: (event: PointerEvent<HTMLButtonElement>) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const target = current.active ? slotAt(event.clientX, event.clientY) : null;
      skipClick.current = current.active; cancel();
      if (target && !locked) onDrop(current.id, target.boxId, target.slot);
    },
    cancel,
  };
}
