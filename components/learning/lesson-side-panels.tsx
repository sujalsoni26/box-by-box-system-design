"use client";
import { useSyncExternalStore } from "react";
import type { LessonHeading } from "@/lib/lesson-headings";
import {
  DEFAULT_SIDE_PANEL,
  parseSidePanel,
  serializeSidePanel,
  SIDE_PANEL_STORAGE_KEY,
  toggleSidePanel,
  type SidePanel,
} from "@/lib/learning/side-panels";
import { LessonNotesPanel } from "./lesson-notes";
import { OnThisPage } from "./on-this-page";

/*
 * Which right-column panel is open. One value per browser tab: kept in this module, so it carries over when
 * moving between lessons, and mirrored to sessionStorage, so a reload keeps it too. Not kept across sessions.
 */
let openPanel: SidePanel | null | undefined;
const listeners = new Set<() => void>();

function readOpenPanel(): SidePanel | null {
  if (openPanel === undefined) {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(SIDE_PANEL_STORAGE_KEY);
    } catch {
      // Storage blocked: use the default.
    }
    openPanel = parseSidePanel(raw);
  }
  return openPanel;
}

function setOpenPanel(next: SidePanel | null) {
  if (next === readOpenPanel()) return;
  openPanel = next;
  try {
    window.sessionStorage.setItem(SIDE_PANEL_STORAGE_KEY, serializeSidePanel(next));
  } catch {
    // Not saved for reloads; it still applies while this page stays open.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverSnapshot = () => DEFAULT_SIDE_PANEL;

/**
 * xl and up: "On this page" and "Notes" in the right column. Both collapse; opening one closes the other.
 * The server and the hydration render use the default (On this page open), so markup always matches; a
 * different choice made earlier in the session applies straight after.
 */
export function LessonSidePanels({ headings, slug, title }: { headings: LessonHeading[]; slug: string; title: string }) {
  const open = useSyncExternalStore(subscribe, readOpenPanel, serverSnapshot);
  // Toggle from what is on screen, which is what the learner clicked on.
  const toggle = (panel: SidePanel) => setOpenPanel(toggleSidePanel(open, panel));

  return (
    <>
      <OnThisPage headings={headings} open={open === "toc"} onToggle={() => toggle("toc")} />
      <LessonNotesPanel slug={slug} title={title} open={open === "notes"} onToggle={() => toggle("notes")} />
    </>
  );
}
