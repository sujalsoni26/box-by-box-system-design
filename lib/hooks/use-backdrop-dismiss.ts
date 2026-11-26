"use client";
import { useRef, type MouseEvent, type PointerEvent } from "react";

/** Is the event's point outside the element's box (i.e. on a modal dialog's backdrop)? */
function outside(e: { clientX: number; clientY: number }, el: Element): boolean {
  const r = el.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/**
 * Close a modal <dialog> when the learner clicks outside it (on the dimmed backdrop). Spread the result on the
 * <dialog>. Only a press that starts and ends outside counts, so selecting text in a field and letting go outside
 * the box does not close it. Clicks inside nested dialogs (a confirmation) are ignored.
 */
export function useBackdropDismiss(close: () => void) {
  const downOutside = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      downOutside.current = e.target === e.currentTarget && outside(e, e.currentTarget);
    },
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      const started = downOutside.current;
      downOutside.current = false;
      if (started && e.target === e.currentTarget && outside(e, e.currentTarget)) close();
    },
  };
}
