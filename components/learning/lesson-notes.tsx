"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import { ChevronDown, Copy, NotebookPen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { NOTE_MAX_LENGTH, useNotesHydrated, useNotesStore } from "@/stores/notes-store";

/*
 * Study notes: one plain-text note per lesson, saved in this browser (stores/notes-store.ts).
 * - xl and up: <LessonNotesPanel> in the right column, under "On this page". <LessonSidePanels> decides
 *   which of the two is open (never both; Notes starts closed).
 * - Below xl: <LessonNotesChip> in the lesson header opens the same editor in a bottom sheet.
 */

const SAVE_DELAY_MS = 400;
const MESSAGE_MS = 4000;
/** Tailwind's `xl` breakpoint, where the right column (and the side panel) appears. */
const XL_QUERY = "(min-width: 80rem)";
const FOCUSABLE = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
const numberFormat = new Intl.NumberFormat("en-US");

function subscribeXl(callback: () => void) {
  const mql = window.matchMedia(XL_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
const xlSnapshot = () => window.matchMedia(XL_QUERY).matches;
const xlServerSnapshot = () => false;

/** True at xl and up. False on the server and during hydration, so markup always matches. */
function useIsXl(): boolean {
  return useSyncExternalStore(subscribeXl, xlSnapshot, xlServerSnapshot);
}

/** First non-empty line, shortened, for the collapsed panel. */
function previewOf(text: string): string {
  const line = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!window.isSecureContext || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Fallback for browsers without the Clipboard API (or when it is blocked): copies the current selection. */
function legacyCopy(): boolean {
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

type EditorVariant = "panel" | "sheet";

/**
 * Plain-text editor for one lesson's note. Saves about 400 ms after typing stops, and straight away on
 * blur, unmount and when the page is hidden. Render it with `key={slug}` so each lesson starts fresh.
 */
function NotesEditor({ slug, lessonTitle, variant }: { slug: string; lessonTitle: string; variant: EditorVariant }) {
  const hydrated = useNotesHydrated();
  const stored = useNotesStore((s) => s.notes[slug]?.text ?? "");
  const setNote = useNotesStore((s) => s.setNote);
  const clearNote = useNotesStore((s) => s.clearNote);

  const [draft, setDraft] = useState(stored);
  const [syncedFrom, setSyncedFrom] = useState(stored);
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [edited, setEdited] = useState(false);
  const [message, setMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const messageTimer = useRef<number | undefined>(undefined);
  /** Text typed here that is not in the store yet (null when nothing is waiting). */
  const unsaved = useRef<string | null>(null);

  const id = useId();
  const textareaId = `${id}-text`;
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;

  // The saved note changed elsewhere (another tab, the other view, the store loading). Follow it,
  // unless the learner is typing here: then their text wins on the next save.
  if (stored !== syncedFrom) {
    setSyncedFrom(stored);
    if (!focused && !pending) setDraft(stored);
  }

  const flush = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    if (unsaved.current === null) return;
    setNote(slug, unsaved.current);
    unsaved.current = null;
    setPending(false);
  };

  // Never lose the last keystrokes: save when the tab is hidden or closed, and when the editor
  // unmounts (panel collapsed, sheet closed, another lesson opened).
  useEffect(() => {
    const save = () => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      if (unsaved.current === null) return false;
      useNotesStore.getState().setNote(slug, unsaved.current);
      unsaved.current = null;
      return true;
    };
    const onPageHide = () => {
      if (save()) setPending(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      save();
    };
  }, [slug]);

  useEffect(() => () => window.clearTimeout(messageTimer.current), []);

  const say = (text: string) => {
    setMessage(text);
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(""), MESSAGE_MS);
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDraft(text);
    setEdited(true);
    setPending(true);
    unsaved.current = text;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  const copy = async () => {
    flush();
    const el = textareaRef.current;
    const text = el?.value ?? draft;
    if (!text) return;
    if (await writeClipboard(text)) {
      say("Copied to clipboard.");
      return;
    }
    // Select the note so the legacy command (or the learner, by hand) can copy it.
    el?.focus();
    el?.select();
    say(legacyCopy() ? "Copied to clipboard." : "Couldn't copy automatically. The note is selected: press Ctrl+C (⌘C on a Mac).");
  };

  const clear = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    unsaved.current = null;
    clearNote(slug);
    setDraft("");
    setPending(false);
    setEdited(true);
    say("Notes cleared.");
    // Clear disables itself once the note is empty, so put focus back in the editor.
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const status = !hydrated ? "Loading…" : pending ? "Saving…" : edited || stored ? "Saved" : "Saves as you type";
  const nearLimit = draft.length > NOTE_MAX_LENGTH * 0.9;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={textareaId} className="sr-only">
        Your notes for {lessonTitle}
      </label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={draft}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // Nothing typed since the last save: pick up any change made elsewhere while focused.
          if (unsaved.current === null) setDraft(useNotesStore.getState().notes[slug]?.text ?? "");
          flush();
        }}
        disabled={!hydrated}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Key ideas, questions, examples…"
        aria-describedby={`${hintId} ${countId}`}
        className={cn(
          "block w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 leading-relaxed text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-accent disabled:opacity-60",
          // Phones need 16px text, or iOS zooms in on focus.
          variant === "panel" ? "h-[clamp(9rem,34dvh,18rem)] min-h-24 text-sm" : "h-[min(18rem,40dvh)] min-h-24 text-base",
        )}
      />
      <p id={hintId} className="sr-only">
        Plain text, saved automatically in this browser only.
      </p>
      <div className="flex items-baseline justify-between gap-2 text-xs text-ink-3">
        <span role="status" className="min-w-0 truncate">
          {status}
        </span>
        <span id={countId} className={cn("shrink-0 font-mono text-[0.68rem] tabular-nums", nearLimit && "text-warn")}>
          <span aria-hidden="true">
            {numberFormat.format(draft.length)} / {numberFormat.format(NOTE_MAX_LENGTH)}
          </span>
          <span className="sr-only">
            {numberFormat.format(draft.length)} of {numberFormat.format(NOTE_MAX_LENGTH)} characters
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void copy()} disabled={!draft}>
          <Copy aria-hidden="true" className="size-3.5" /> Copy
        </Button>
        {/* A disabled fieldset disables the confirmation's trigger while the note is empty; the
            child selectors give that trigger the same small size as Copy. */}
        <fieldset
          disabled={!draft}
          role="presentation"
          className="contents [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:text-[0.82rem]"
        >
          <ConfirmDialog
            trigger="Clear"
            triggerVariant="ghost"
            title="Clear these notes?"
            description={
              <>
                This deletes your notes for <strong>{lessonTitle}</strong> from this browser. It can&apos;t be undone.
              </>
            }
            confirmLabel="Clear notes"
            onConfirm={clear}
          />
        </fieldset>
      </div>
      {/* Always rendered (even when empty) so screen readers announce Copy and Clear results. */}
      <p role="status" className="text-xs text-ink-2">
        {message}
      </p>
    </div>
  );
}

/**
 * xl and up: a collapsible Notes section in the right column. `open` and `onToggle` come from
 * <LessonSidePanels>, which keeps it and "On this page" from being open together (Notes starts closed).
 */
export function LessonNotesPanel({ slug, title, open, onToggle }: { slug: string; title: string; open: boolean; onToggle: () => void }) {
  const hydrated = useNotesHydrated();
  const note = useNotesStore((s) => s.notes[slug]?.text ?? "");
  const isXl = useIsXl();
  const regionRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const regionId = `${id}-notes`;

  const preview = hydrated ? previewOf(note) : "";

  const toggle = () => {
    onToggle();
    // The column scrolls on its own; bring the opened editor into view when it lands below the fold.
    if (!open) requestAnimationFrame(() => regionRef.current?.scrollIntoView({ block: "nearest" }));
  };

  return (
    <section aria-label="Study notes" data-companion-avoid="" className="text-sm not-first:mt-5 not-first:border-t not-first:border-line not-first:pt-5">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={toggle}
          data-testid="side-panel-notes-toggle"
          className="group block w-full rounded-md py-1 text-left"
        >
          <span className="flex items-center gap-2 text-ink-3 transition-colors group-hover:text-ink">
            <NotebookPen aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em]">Notes</span>
            {preview ? (
              <>
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="sr-only">, has notes</span>
              </>
            ) : null}
            <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")} />
          </span>
          {!open && preview ? (
            <span aria-hidden="true" className="mt-1 block truncate text-[0.8rem] text-ink-2">
              {preview}
            </span>
          ) : null}
        </button>
      </h2>
      <div ref={regionRef} id={regionId} hidden={!open} data-testid="side-panel-notes" data-open={open ? "true" : "false"} className="mt-3">
        {open && isXl ? <NotesEditor key={slug} slug={slug} lessonTitle={title} variant="panel" /> : null}
      </div>
    </section>
  );
}

/**
 * Below xl: a "Notes" chip for the lesson header that opens the editor in a bottom sheet. The sheet is a
 * native modal <dialog>: top layer (above the bottom nav and the companion), the page behind is inert,
 * Escape closes it, and focus goes back to the chip.
 */
export function LessonNotesChip({ slug, title }: { slug: string; title: string }) {
  const hydrated = useNotesHydrated();
  const hasNote = useNotesStore((s) => Boolean(s.notes[slug]));
  const isXl = useIsXl();
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const on = hydrated && hasNote;

  // Open as a modal, lock page scroll behind it, and move focus in (to the text on desktop-class
  // pointers; on touch the close button, so the keyboard does not cover the sheet straight away).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    if (window.matchMedia("(pointer: fine)").matches) dialog.querySelector("textarea")?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const gutter = root.style.getPropertyValue("scrollbar-gutter");
    if (window.innerWidth > root.clientWidth) root.style.setProperty("scrollbar-gutter", "stable");
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      if (gutter) root.style.setProperty("scrollbar-gutter", gutter);
      else root.style.removeProperty("scrollbar-gutter");
      if (dialog.open) dialog.close();
    };
  }, [open]);

  // From xl the side panel takes over.
  useEffect(() => {
    if (isXl) dialogRef.current?.close();
  }, [isXl]);

  const close = () => dialogRef.current?.close();

  const onClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    // React also delivers the nested "Clear" confirmation's close event here; ignore it.
    if (e.target !== e.currentTarget) return;
    setOpen(false);
    chipRef.current?.focus();
  };

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  };

  // Keep Tab inside the sheet (a modal dialog would otherwise let focus reach the browser UI).
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    if (e.key !== "Tab" || (e.target as Element).closest("dialog") !== dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.closest("dialog") === dialog && !el.matches(":disabled") && el.getClientRects().length > 0,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hydrated}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={on ? `Notes for ${title} (has notes)` : `Notes for ${title}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold text-ink-3 transition-colors hover:text-ink disabled:opacity-60 xl:hidden"
      >
        <NotebookPen aria-hidden="true" className="size-3.5" />
        Notes
        {on ? <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> : null}
      </button>
      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={titleId}
        data-companion-avoid=""
        onClose={onClose}
        onClick={onBackdropClick}
        onKeyDown={onKeyDown}
        className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-2xl border border-b-0 border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/35 sm:mx-auto sm:mb-4 sm:max-w-xl sm:rounded-2xl sm:border-b"
      >
        {open ? (
          <div className="flex max-h-[75dvh] animate-rise flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-lg font-bold leading-tight">
                  Notes
                </h2>
                <p className="mt-0.5 truncate text-sm text-ink-3">{title}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close notes"
                className="-mr-1 -mt-1 grid size-10 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <NotesEditor key={slug} slug={slug} lessonTitle={title} variant="sheet" />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
