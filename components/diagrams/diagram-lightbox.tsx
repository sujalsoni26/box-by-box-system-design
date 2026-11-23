"use client";
import { Scan, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Size } from "@/lib/diagrams/constrained";
import { suffixSvgIds } from "@/lib/diagrams/svg-ids";
import { anchoredScroll, atBound, clampZoom, fitScale, formatZoom, initialZoom, stepZoom, wheelZoomFactor, zoomBounds } from "@/lib/diagrams/zoom";
import { cn } from "@/lib/utils";
import { focusableWithin, lockPageScroll } from "./lightbox-dom";

export interface DiagramLightboxProps {
  /** The figure's caption; names the dialog ("Diagram" without one). */
  caption?: string;
  /** Size the diagram was drawn at (zoom 1). */
  natural: Size;
  /** The diagram again, as a React node (static SVG component)… */
  node?: ReactNode;
  /** …or as SVG markup (Mermaid). Its ids get a suffix so the copy never collides with the inline original. */
  markup?: string;
  onClose: () => void;
  /** Focus goes back here on close when the opener was not focusable itself (a click on the diagram). */
  returnFocusRef: RefObject<HTMLElement | null>;
}

/** How the zoom was chosen, so a resize (rotation, window) can keep the same intent. */
type Mode = "initial" | "fit" | "manual";
type Point = { x: number; y: number };
type Drag = { x: number; y: number; left: number; top: number; moved: boolean; onEmpty: boolean };

const ID_SUFFIX = "-lightbox";
const PAN_STEP = 60;
const PAN_STEP_LARGE = 240;
const DRAG_SLOP = 4;

const controlClass =
  "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-line aria-disabled:hover:bg-surface aria-disabled:hover:text-ink-2";

const px = (value: string) => parseFloat(value) || 0;

/**
 * Full-screen, in-page viewer for a diagram that is too cramped in the lesson column (opened by
 * DiagramFrame). Modal: portalled to <body>, role="dialog" + aria-modal (which also keeps the companion
 * quiet, see lib/companion/quiet.ts), focus trapped, page scroll locked, Escape / Close / backdrop close
 * it and focus returns to the opener. Zoom resizes the SVG itself (vector, always sharp); pan by
 * dragging, scrolling or arrow keys; pinch or Ctrl/⌘ + wheel zooms around the pointer.
 */
export function DiagramLightbox({ caption, natural, node, markup, onClose, returnFocusRef }: DiagramLightboxProps) {
  const titleId = useId();
  const hintId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Zoom lives in refs so pointer, wheel and key handlers always see the latest value; state mirrors it for the UI.
  const zoomRef = useRef(1);
  const fitRef = useRef(1);
  const modeRef = useRef<Mode>("initial");
  const placedRef = useRef(false);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<Drag | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const tapToCloseRef = useRef(false);
  const backdropPressRef = useRef(false);
  const [view, setView] = useState({ zoom: 1, fit: 1 });
  const clone = useMemo(() => (markup ? suffixSvgIds(markup, ID_SUFFIX) : null), [markup]);
  const title = caption?.trim() || "Diagram";
  const { width: naturalWidth, height: naturalHeight } = natural;

  function sizeCanvas(zoom: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.width = `${naturalWidth * zoom}px`;
    canvas.style.height = `${naturalHeight * zoom}px`;
  }

  /** Point in the viewport's visible (client) area, from a pointer or wheel event. */
  function viewportPoint(clientX: number, clientY: number): Point | null {
    const vp = viewportRef.current;
    if (!vp) return null;
    const box = vp.getBoundingClientRect();
    return { x: clientX - box.left - vp.clientLeft, y: clientY - box.top - vp.clientTop };
  }

  /** Zoom to `next` (clamped), keeping the content under `anchor` (default: the centre) where it is. */
  function applyZoom(next: number, mode: Mode, anchor?: Point | null) {
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!vp || !canvas) return;
    const previous = zoomRef.current;
    const zoom = clampZoom(next, zoomBounds(fitRef.current));
    const ax = anchor?.x ?? vp.clientWidth / 2;
    const ay = anchor?.y ?? vp.clientHeight / 2;
    const contentX = (vp.scrollLeft + ax - canvas.offsetLeft) / previous;
    const contentY = (vp.scrollTop + ay - canvas.offsetTop) / previous;
    zoomRef.current = zoom;
    modeRef.current = mode;
    sizeCanvas(zoom);
    // Reading offsetLeft after resizing forces layout, so the new scroll range is already in place.
    vp.scrollLeft = anchoredScroll(contentX, ax, canvas.offsetLeft, zoom);
    vp.scrollTop = anchoredScroll(contentY, ay, canvas.offsetTop, zoom);
    setView({ zoom, fit: fitRef.current });
  }

  /**
   * Fit-to-screen scale for the viewport, less its padding and the sheet's padding + border. Uses the
   * offset box (scrollbars included): a fitted diagram has no scrollbars, so that is the space it gets.
   */
  function measureFit(): number {
    const vp = viewportRef.current;
    const sheet = canvasRef.current?.parentElement;
    if (!vp || !sheet) return 1;
    const v = getComputedStyle(vp);
    const s = getComputedStyle(sheet);
    const chromeX = px(v.paddingLeft) + px(v.paddingRight) + px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
    const chromeY = px(v.paddingTop) + px(v.paddingBottom) + px(s.paddingTop) + px(s.paddingBottom) + px(s.borderTopWidth) + px(s.borderBottomWidth);
    return fitScale({ width: naturalWidth, height: naturalHeight }, { width: vp.offsetWidth - chromeX, height: vp.offsetHeight - chromeY });
  }

  const zoomBy = (direction: 1 | -1) =>
    applyZoom(stepZoom(zoomRef.current, direction, zoomBounds(fitRef.current), [fitRef.current]), "manual");
  const zoomToFit = () => applyZoom(fitRef.current, "fit");
  const zoomToActual = () => applyZoom(1, "manual");

  // First layout and every resize of the dialog (window resize, rotation, mobile toolbars).
  const relayout = useEffectEvent(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const fit = measureFit();
    fitRef.current = fit;
    if (!placedRef.current) {
      // Opening view: fit-to-screen if that stays readable, else natural size from the top-left corner.
      placedRef.current = true;
      const zoom = initialZoom(fit);
      zoomRef.current = zoom;
      modeRef.current = "initial";
      sizeCanvas(zoom);
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
      setView({ zoom, fit });
      return;
    }
    const mode = modeRef.current;
    applyZoom(mode === "fit" ? fit : mode === "initial" ? initialZoom(fit) : zoomRef.current, mode);
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    // The panel, not the viewport: zooming toggles the viewport's scrollbars, which would re-trigger the
    // observer from inside its own callback ("ResizeObserver loop" errors). The panel only follows the window.
    const observer = new ResizeObserver(() => relayout());
    observer.observe(panel);
    return () => observer.disconnect();
    // A new natural size (Mermaid re-rendered for a theme change) re-runs the layout through a fresh observer.
  }, [naturalWidth, naturalHeight]);

  // The cloned SVG fills the sized canvas: override the inline-page sizing (w-full, min-w-[540px], Mermaid's max-width).
  useLayoutEffect(() => {
    const svg = canvasRef.current?.querySelector("svg");
    if (!svg) return;
    svg.style.setProperty("display", "block");
    svg.style.setProperty("width", "100%");
    svg.style.setProperty("height", "100%");
    svg.style.setProperty("max-width", "none");
    svg.style.setProperty("min-width", "0");
  }, [clone, node]);

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms around the pointer; a plain wheel scrolls (pans) natively.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    applyZoom(zoomRef.current * wheelZoomFactor(e.deltaY, e.deltaMode), "manual", viewportPoint(e.clientX, e.clientY));
  });

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const handler = (e: WheelEvent) => onWheel(e);
    vp.addEventListener("wheel", handler, { passive: false });
    return () => vp.removeEventListener("wheel", handler);
  }, []);

  // Keyboard: Escape closes, Tab stays inside, + − 0 1 zoom, arrows pan (Shift for bigger steps).
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const panel = panelRef.current;
    const vp = viewportRef.current;
    if (!panel || !vp) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const items = focusableWithin(panel);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (!inside || (e.shiftKey && (active === first || active === panel)) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const step = e.shiftKey ? PAN_STEP_LARGE : PAN_STEP;
    switch (e.key) {
      case "+":
      case "=":
        zoomBy(1);
        break;
      case "-":
      case "_":
        zoomBy(-1);
        break;
      case "0":
        zoomToFit();
        break;
      case "1":
        zoomToActual();
        break;
      case "ArrowLeft":
        vp.scrollLeft -= step;
        break;
      case "ArrowRight":
        vp.scrollLeft += step;
        break;
      case "ArrowUp":
        vp.scrollTop -= step;
        break;
      case "ArrowDown":
        vp.scrollTop += step;
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Open: lock page scroll, focus Close, keep focus inside. Close/unmount: undo all, return focus to the opener.
  useEffect(() => {
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    const fallback = returnFocusRef.current;
    const unlock = lockPageScroll();
    closeRef.current?.focus({ preventScroll: true });
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && !panel.contains(e.target)) closeRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      unlock();
      const target = opener?.isConnected ? opener : fallback;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  // Pointer: one pointer drags (pans), two pinch-zoom around their midpoint. A tap on the empty area around
  // the diagram closes, like the backdrop. touch-action: none hands touch gestures to these handlers.
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const vp = e.currentTarget;
    const at = viewportPoint(e.clientX, e.clientY);
    // Leave the scrollbars to the browser.
    if (!at || at.x > vp.clientWidth || at.y > vp.clientHeight) return;
    const pointers = pointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      vp.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone (fast taps); dragging just stops at the edge then.
    }
    tapToCloseRef.current = false;
    if (pointers.size === 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop, moved: false, onEmpty: e.target === vp };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchRef.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: zoomRef.current };
      if (dragRef.current) dragRef.current.moved = true;
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const vp = e.currentTarget;
    const pinch = pinchRef.current;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      applyZoom(pinch.zoom * (distance / pinch.distance), "manual", viewportPoint((a.x + b.x) / 2, (a.y + b.y) / 2));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    drag.moved = true;
    vp.scrollLeft = drag.left - dx;
    vp.scrollTop = drag.top - dy;
  }

  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    const vp = e.currentTarget;
    const drag = dragRef.current;
    const tap = e.type === "pointerup" && pointers.size === 1 && drag !== null && !drag.moved && drag.onEmpty;
    pointers.delete(e.pointerId);
    if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
    if (pointers.size < 2) pinchRef.current = null;
    if (pointers.size === 1) {
      // Lifting one finger of a pinch: keep panning with the other, from where it is now.
      const [rest] = [...pointers.values()];
      dragRef.current = { x: rest.x, y: rest.y, left: vp.scrollLeft, top: vp.scrollTop, moved: true, onEmpty: false };
    } else if (pointers.size === 0) {
      dragRef.current = null;
      // Close on the click that follows, not here, so the click cannot land on the page underneath.
      tapToCloseRef.current = tap;
    }
  }

  function onViewportClick() {
    if (!tapToCloseRef.current) return;
    tapToCloseRef.current = false;
    onClose();
  }

  // Backdrop (outside the panel, sm and up): close only when the press also started there.
  function onBackdropPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    backdropPressRef.current = e.target === e.currentTarget;
  }
  function onBackdropClick(e: ReactMouseEvent<HTMLDivElement>) {
    const pressed = backdropPressRef.current;
    backdropPressRef.current = false;
    if (pressed && e.target === e.currentTarget) onClose();
  }

  const bounds = zoomBounds(view.fit);
  const canZoomOut = view.zoom > bounds.min && !atBound(view.zoom, bounds.min);
  const canZoomIn = view.zoom < bounds.max && !atBound(view.zoom, bounds.max);

  return createPortal(
    <div
      data-companion-avoid=""
      onPointerDown={onBackdropPointerDown}
      onClick={onBackdropClick}
      className="fixed inset-0 z-100 flex bg-canvas/80 backdrop-blur-sm transition-opacity duration-200 ease-out starting:opacity-0 motion-reduce:transition-none sm:p-6 lg:p-10"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        tabIndex={-1}
        data-testid="diagram-lightbox"
        className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-surface text-ink outline-none transition-[opacity,scale] duration-200 ease-out starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none sm:rounded-2xl sm:border sm:border-line-strong sm:shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            {caption ? (
              <p aria-hidden="true" className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-link">
                Diagram
              </p>
            ) : null}
            <h2 id={titleId} className="line-clamp-2 font-display text-[1.02rem] font-bold leading-snug text-ink">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close diagram"
            title="Close (Esc)"
            data-testid="diagram-lightbox-close"
            className={controlClass}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div
          ref={viewportRef}
          role="group"
          aria-label="Zoomable diagram"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onClick={onViewportClick}
          className="relative flex min-h-0 flex-1 cursor-grab touch-none select-none overflow-auto overscroll-contain bg-canvas p-4 outline-offset-[-3px] active:cursor-grabbing sm:p-6"
        >
          <div className="m-auto shrink-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-soft)]">
            {clone !== null ? (
              <div ref={canvasRef} role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: clone }} />
            ) : (
              <div ref={canvasRef}>{node}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:justify-between lg:px-5">
          <p id={hintId} className="sr-only lg:not-sr-only lg:text-[0.8rem] lg:text-ink-3">
            Drag or use the arrow keys to pan. Pinch, Ctrl + scroll, or the + and − keys zoom; 0 fits the screen, 1 is actual size. Esc closes.
          </p>
          <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (canZoomOut) zoomBy(-1);
              }}
              aria-disabled={!canZoomOut}
              aria-label="Zoom out"
              title="Zoom out (−)"
              data-testid="diagram-zoom-out"
              className={controlClass}
            >
              <ZoomOut aria-hidden="true" className="size-5" />
            </button>
            <output aria-live="polite" aria-atomic="true" className="min-w-14 text-center font-mono text-sm font-semibold tabular-nums text-ink">
              {formatZoom(view.zoom)}
            </output>
            <button
              type="button"
              onClick={() => {
                if (canZoomIn) zoomBy(1);
              }}
              aria-disabled={!canZoomIn}
              aria-label="Zoom in"
              title="Zoom in (+)"
              data-testid="diagram-zoom-in"
              className={controlClass}
            >
              <ZoomIn aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={zoomToFit}
              aria-label="Fit to screen"
              title="Fit to screen (0)"
              data-testid="diagram-zoom-reset"
              className={cn(controlClass, "px-2.5 text-[0.82rem] font-bold")}
            >
              <Scan aria-hidden="true" className="size-4" />
              Fit
            </button>
            <button
              type="button"
              onClick={zoomToActual}
              aria-label="Actual size, 1:1"
              title="Actual size (1)"
              data-testid="diagram-zoom-actual"
              className={cn(controlClass, "px-2.5 font-mono text-[0.82rem] font-bold")}
            >
              1:1
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
