"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Bookmark, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleHelp, Flag } from "lucide-react";
import { LevelChip } from "@/components/ui/chip";
import { ProgressRing } from "@/components/ui/progress-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getModuleLessons, knowledgeCheckAfter, modules, moduleProgress, nextIncompleteLesson, lessonHref } from "@/lib/curriculum";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cn, formatHours } from "@/lib/utils";
import { useProgressStore } from "@/stores/progress-store";
import type { Level, ModuleId } from "@/types/curriculum";

const OPEN_KEY = "sdn-roadmap-open";
const isModuleId = (id: string): id is ModuleId => modules.some((m) => m.id === id);

/**
 * Which modules are expanded. Until the page hydrates every module is collapsed (a compact list); then it opens
 * the modules this browser had open last time or, the first time, the module with the next lesson to study.
 * A `/learn#<module>` link always opens (and scrolls to) that module.
 */
function useOpenModules(hydrated: boolean, completed: Record<string, number>): [Set<ModuleId>, Dispatch<SetStateAction<Set<ModuleId>>>] {
  const [open, setOpen] = useState<Set<ModuleId>>(() => new Set());
  const ready = useRef(false);

  useEffect(() => {
    if (!hydrated || ready.current) return;
    ready.current = true;
    let initial: ModuleId[] | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null");
      if (Array.isArray(saved)) initial = saved.filter((x): x is ModuleId => typeof x === "string" && isModuleId(x));
    } catch {
      /* storage blocked or corrupt: fall back to the current module */
    }
    initial ??= [nextIncompleteLesson(completed)?.moduleId ?? modules[0].id];
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (isModuleId(hash) && !initial.includes(hash)) initial.push(hash);
    // Hydration has to finish before reading this browser's storage, so the first paint matches the server.
    setOpen(new Set(initial));
    if (isModuleId(hash)) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
  }, [hydrated, completed]);

  useEffect(() => {
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (isModuleId(hash)) setOpen((prev) => (prev.has(hash) ? prev : new Set([...prev, hash])));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
    } catch {
      /* not saved: it is only a convenience */
    }
  }, [open]);

  return [open, setOpen];
}

type LevelFilter = "all" | Level;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

/** Full learning roadmap: every module and lesson, with completion state and a level highlight. */
export function Roadmap() {
  const hydrated = useHydrated();
  const completedRaw = useProgressStore((s) => s.completed);
  const bookmarks = useProgressStore((s) => s.bookmarks);
  const review = useProgressStore((s) => s.review);
  const completed = hydrated ? completedRaw : {};
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [open, setOpen] = useOpenModules(hydrated, completedRaw);
  const allOpen = modules.every((m) => open.has(m.id));
  const toggle = (id: ModuleId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink-2">Highlight level</span>
          <SegmentedControl<LevelFilter> label="Highlight lessons by level" options={FILTERS} value={filter} onChange={setFilter} size="sm" />
        </div>
        <button
          type="button"
          data-testid="roadmap-toggle-all"
          onClick={() => setOpen(allOpen ? new Set() : new Set(modules.map((m) => m.id)))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-bold text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          {allOpen ? <ChevronsDownUp aria-hidden="true" className="size-4" /> : <ChevronsUpDown aria-hidden="true" className="size-4" />}
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ol className="relative flex flex-col gap-6 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-0.5 before:bg-line">
        {modules.map((m) => {
          const p = moduleProgress(m.id, completed);
          const isOpen = open.has(m.id);
          const listId = `${m.id}-lessons`;
          const minutes = getModuleLessons(m.id).reduce((s, l) => s + l.minutes, 0);
          return (
            <li key={m.id} id={m.id} className="relative scroll-mt-24 pl-14" data-open={isOpen ? "" : undefined}>
              <span
                className={cn(
                  "absolute left-0 top-0 grid size-10 place-items-center rounded-full border-2 bg-canvas font-mono text-sm font-bold",
                  p.fraction === 1 ? "border-good bg-good text-accent-ink" : "border-accent text-link",
                )}
              >
                {p.fraction === 1 ? <Check aria-hidden="true" className="size-5" strokeWidth={3} /> : m.number}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                    Module {m.number} · stage: <span className="text-amber-ink">{m.stage}</span>
                  </p>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={listId}
                      data-testid={`roadmap-module-${m.id}`}
                      onClick={() => toggle(m.id)}
                      className="group -mx-1 flex items-center gap-2 rounded-md px-1 text-left hover:text-link"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cn("size-5 shrink-0 text-ink-3 transition-transform group-hover:text-link", !isOpen && "-rotate-90")}
                      />
                      {m.title}
                    </button>
                  </h2>
                  <p className="mt-1 text-sm text-ink-3">
                    {p.total} lessons · {formatHours(minutes)}
                  </p>
                  {isOpen ? <p className="mt-1 max-w-2xl text-ink-2">{m.description}</p> : null}
                </div>
                <span className="flex items-center gap-2 font-mono text-sm tabular-nums text-ink-2">
                  {p.done}/{p.total}
                  <ProgressRing value={p.fraction} label={`${m.title} progress`} />
                </span>
              </div>
              <ul id={listId} hidden={!isOpen} className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
                {getModuleLessons(m.id).map((l) => {
                  const done = Boolean(completed[l.slug]);
                  const dim = filter !== "all" && l.level !== filter;
                  const check = knowledgeCheckAfter(l.slug);
                  return (
                    <li key={l.slug} className={cn("border-b border-line last:border-b-0 transition-opacity", dim && "opacity-40")}>
                      <Link
                        href={lessonHref(l.slug)}
                        className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <span
                          className={cn(
                            "grid size-5 place-items-center rounded-full border-2",
                            done ? "border-good bg-good text-accent-ink" : "border-line-strong",
                          )}
                        >
                          {done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="mr-2 font-mono text-xs text-ink-3">{l.number}</span>
                          <span className="font-bold text-ink">{l.title}</span>
                          {done ? <span className="sr-only"> (learned)</span> : null}
                          <span className="mt-0.5 block truncate text-sm text-ink-3">{l.problem}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {hydrated && review[l.slug] ? <Flag aria-label="Marked for review" className="size-4 fill-current text-review" /> : null}
                          {hydrated && bookmarks.includes(l.slug) ? <Bookmark aria-label="Bookmarked" className="size-4 text-amber-ink" /> : null}
                          {check ? <CircleHelp aria-label="Has a knowledge check" className="size-4 text-violet" /> : null}
                          <span className="hidden font-mono text-xs text-ink-3 sm:inline">{l.minutes} min</span>
                          <LevelChip level={l.level} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
