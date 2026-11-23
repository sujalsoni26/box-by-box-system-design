"use client";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { glossaryByTerm } from "@/data/glossary";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { usePreferencesStore } from "@/stores/preferences-store";

interface AcronymProps {
  term: string;
  children?: ReactNode;
}

const MARGIN = 12;
const GAP = 8;

function supportsPopover(): boolean {
  return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
}

/** Below the term (or above it when there is no room), clamped inside the viewport. */
function place(trigger: HTMLElement, pop: HTMLElement) {
  const t = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const left = Math.max(MARGIN, Math.min(t.left + t.width / 2 - w / 2, vw - w - MARGIN));
  const below = t.bottom + GAP;
  const top = below + h > vh - MARGIN && t.top - GAP - h >= MARGIN ? t.top - GAP - h : below;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

/**
 * First mention of a glossary term in a lesson (inserted by lib/mdx/remark-acronyms.mjs).
 * Hover or keyboard focus shows the full form; tap or click pins it open; Escape closes.
 * Screen readers hear the full form as the button's description.
 *
 * The popup is a manual popover in the browser's top layer, so table wrappers, diagram scrollers
 * and other overflow containers can't clip it and no z-index or stacking context can cover it.
 * It stays in place in the DOM, so Tab still moves from the term into its buttons. Browsers
 * without the Popover API get the same element with fixed positioning.
 */
export function Acronym({ term, children }: AcronymProps) {
  const entry = glossaryByTerm[term];
  const hydrated = useHydrated();
  const known = usePreferencesStore((s) => s.knownTerms.includes(term));
  const setTermKnown = usePreferencesStore((s) => s.setTermKnown);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const id = useId();
  const popId = `${id}-pop`;
  const fullId = `${id}-full`;

  // Show in the top layer and position it; follow the term while the page scrolls or resizes.
  useLayoutEffect(() => {
    const pop = popRef.current;
    const trigger = triggerRef.current;
    if (!open || !pop || !trigger) return;
    const usePopover = supportsPopover();
    if (usePopover && !pop.matches(":popover-open")) pop.showPopover();
    place(trigger, pop);
    const reposition = () => place(trigger, pop);
    window.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
      if (usePopover && pop.matches(":popover-open")) pop.hidePopover();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const focusInside = popRef.current?.contains(document.activeElement);
      setOpen(false);
      setPinned(false);
      if (focusInside) triggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  if (!entry || (hydrated && known)) return <>{children ?? term}</>;

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    if (pinned) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };
  // Focus moving between the term and its popup keeps it open; leaving both closes it.
  const onBlurWithin = (e: FocusEvent) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node)) hideSoon();
  };

  return (
    <span ref={wrapRef} className="relative inline-block" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={popId}
        aria-describedby={fullId}
        onFocus={show}
        onBlur={onBlurWithin}
        onClick={() => {
          setPinned((p) => !p || !open);
          show();
        }}
        className="cursor-help rounded-sm border-b-[1.5px] border-dotted border-accent font-[inherit] leading-[inherit] text-inherit transition-colors hover:bg-accent-soft aria-expanded:bg-accent-soft"
      >
        {children ?? term}
      </button>
      <span
        ref={popRef}
        id={popId}
        popover="manual"
        role="group"
        aria-label={`${term} definition`}
        hidden={!open}
        onBlur={onBlurWithin}
        className="fixed z-50 m-0 block w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-rise overflow-visible rounded-xl border border-line-strong bg-surface px-3.5 pb-2.5 pt-3 text-left font-sans text-[0.9rem] font-normal not-italic leading-snug text-ink shadow-[var(--shadow-lift)] [inset:auto]"
      >
        <span className="block font-mono text-[0.72rem] font-semibold tracking-[0.1em] text-link">{term}</span>
        <span id={fullId} className="block font-display text-[1.02rem] font-bold">
          {entry.full}
        </span>
        {entry.note ? <span className="mt-1 block text-ink-2">{entry.note}</span> : null}
        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-line pt-2 text-[0.78rem]">
          <button
            type="button"
            className="font-bold text-ink-3 underline underline-offset-2 hover:text-link"
            onClick={() => {
              setTermKnown(term, true);
              setOpen(false);
            }}
          >
            I know this, stop hinting
          </button>
          <Link href={`/glossary#term-${encodeURIComponent(term)}`} className="font-bold text-ink-3 underline underline-offset-2 hover:text-link">
            Glossary
          </Link>
        </span>
      </span>
    </span>
  );
}
