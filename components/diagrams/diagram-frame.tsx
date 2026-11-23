"use client";
import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { isConstrained, naturalSize, type Size } from "@/lib/diagrams/constrained";
import { cn } from "@/lib/utils";
import { DiagramLightbox } from "./diagram-lightbox";

interface DiagramFrameProps {
  ref?: Ref<HTMLElement>;
  caption?: string;
  /** The inline diagram; its first <svg> is what gets measured. */
  children: ReactNode;
  /** The same diagram for the lightbox, as a React node (static SVG component)… */
  expandedNode?: ReactNode;
  /** …or as SVG markup (Mermaid). With neither, the frame never offers the lightbox. */
  expandedMarkup?: string;
}

interface Measured {
  constrained: boolean;
  natural: Size | null;
}

const sameSize = (a: Size | null, b: Size | null) => a === b || (!!a && !!b && a.width === b.width && a.height === b.height);

/** Inside the scroller's client area (not on its scrollbar). */
function onContent(el: HTMLElement, clientX: number, clientY: number): boolean {
  const box = el.getBoundingClientRect();
  return clientX - box.left - el.clientLeft <= el.clientWidth && clientY - box.top - el.clientTop <= el.clientHeight;
}

/**
 * Captioned, horizontally scrollable figure for a static or Mermaid diagram. When the diagram is
 * constrained (scaled down noticeably or overflowing, see lib/diagrams/constrained.ts) it gets an Expand
 * button and a zoom-in cursor, and clicking it opens DiagramLightbox. Diagrams that fit get neither: no
 * button, no tab stop, no click behaviour. Re-measured whenever the scroller or the SVG resizes and when
 * the Mermaid markup changes (first render, theme switch).
 */
export function DiagramFrame({ ref, caption, children, expandedNode, expandedMarkup }: DiagramFrameProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const pressOnContentRef = useRef(false);
  const captionId = useId();
  const [measured, setMeasured] = useState<Measured>({ constrained: false, natural: null });
  const [open, setOpen] = useState(false);
  const expandable = expandedNode != null || Boolean(expandedMarkup);
  const constrained = expandable && measured.constrained && measured.natural !== null;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!expandable || !scroller || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const svg = scroller.querySelector("svg");
      if (!svg) return;
      const rendered = svg.getBoundingClientRect();
      const natural =
        naturalSize({ viewBox: svg.getAttribute("viewBox"), width: svg.getAttribute("width"), height: svg.getAttribute("height") }) ??
        (rendered.width > 0 && rendered.height > 0 ? { width: rendered.width, height: rendered.height } : null);
      const next: Measured = {
        constrained: natural !== null && isConstrained(natural.width, rendered.width, scroller.scrollWidth, scroller.clientWidth),
        natural,
      };
      setMeasured((prev) => (prev.constrained === next.constrained && sameSize(prev.natural, next.natural) ? prev : next));
    };
    // The first notification arrives right after observe(), so this also takes the initial measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    const svg = scroller.querySelector("svg");
    if (svg) observer.observe(svg);
    return () => observer.disconnect();
    // New Mermaid markup means a new <svg> element to observe and measure.
  }, [expandable, expandedMarkup]);

  const close = useCallback(() => setOpen(false), []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pressOnContentRef.current = onContent(e.currentTarget, e.clientX, e.clientY);
  };

  const onDiagramClick = (e: MouseEvent<HTMLDivElement>) => {
    const pressed = pressOnContentRef.current;
    pressOnContentRef.current = false;
    // Not after dragging a scrollbar, following a link, or selecting text.
    if (!pressed || !onContent(e.currentTarget, e.clientX, e.clientY)) return;
    if (e.target instanceof Element && e.target.closest("a, button, input, select, textarea, summary")) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    setOpen(true);
  };

  return (
    <figure ref={ref} className="not-prose my-8" data-companion-avoid="" data-constrained={constrained ? "true" : "false"}>
      <div className="relative">
        <div
          ref={scrollerRef}
          onPointerDown={constrained ? onPointerDown : undefined}
          onClick={constrained ? onDiagramClick : undefined}
          className={cn("overflow-x-auto rounded-2xl border border-line bg-surface p-4", constrained && "cursor-zoom-in")}
        >
          {children}
        </div>
        {constrained || open ? (
          <button
            ref={expandRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-describedby={caption ? captionId : undefined}
            data-testid="diagram-expand"
            title="Expand diagram"
            // Compact, in the corner padding, so it covers as little of the diagram as possible.
            className="absolute right-1.5 top-1.5 z-10 grid size-9 place-items-center rounded-lg border border-line-strong bg-surface/90 text-ink-2 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-colors hover:border-ink-3 hover:text-ink"
          >
            <Maximize2 aria-hidden="true" className="size-4" />
            <span className="sr-only">Expand diagram</span>
          </button>
        ) : null}
      </div>
      {caption ? (
        <figcaption id={captionId} className="mt-2 text-center text-sm italic text-ink-3">
          {caption}
        </figcaption>
      ) : null}
      {open && expandable && measured.natural ? (
        <DiagramLightbox
          caption={caption}
          natural={measured.natural}
          node={expandedNode}
          markup={expandedMarkup}
          onClose={close}
          returnFocusRef={expandRef}
        />
      ) : null}
    </figure>
  );
}
