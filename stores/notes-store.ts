import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { persistenceAdapter, STORAGE_KEYS } from "@/lib/storage/adapter";

/** Longest note kept per lesson, in characters (keeps every note well inside the storage quota). */
export const NOTE_MAX_LENGTH = 10_000;

export interface LessonNote {
  /** Plain text, exactly as typed or pasted. */
  text: string;
  updatedAt: number;
}

export interface NotesState {
  /** Lesson slug -> note. A lesson without notes has no entry. */
  notes: Record<string, LessonNote>;
}

interface NotesActions {
  /** Saves the note; empty (or whitespace-only) text deletes the entry. */
  setNote: (slug: string, text: string) => void;
  clearNote: (slug: string) => void;
}

/*
 * Whether the desktop Notes panel is open is not kept here: it is shared with "On this page" (only one is
 * open at a time) and lives in components/learning/lesson-side-panels.tsx for the browser session. Data
 * saved by older builds may still have a `panelOpen` field; it is ignored and dropped on the next save.
 */
type PersistedNotes = Pick<NotesState, "notes">;

/** Keeps only well-formed entries; anything else in storage is ignored rather than trusted. */
function sanitizeNotes(value: unknown): Record<string, LessonNote> {
  const notes: Record<string, LessonNote> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return notes;
  for (const [slug, entry] of Object.entries(value)) {
    if (!slug || slug === "__proto__" || !entry || typeof entry !== "object") continue;
    const { text, updatedAt } = entry as Partial<Record<keyof LessonNote, unknown>>;
    if (typeof text !== "string" || !text.trim()) continue;
    notes[slug] = {
      text: text.slice(0, NOTE_MAX_LENGTH),
      updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  }
  return notes;
}

function parseStored(raw: string | null): StorageValue<PersistedNotes> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as StorageValue<PersistedNotes>) : null;
  } catch {
    // Corrupt JSON: start empty instead of failing hydration. The next save overwrites it.
    return null;
  }
}

/** JSON storage over the shared adapter that tolerates unreadable data. */
const notesStorage: PersistStorage<PersistedNotes> = {
  getItem: (name) => {
    const raw = persistenceAdapter.getItem(name);
    // The adapter may be async (a future server adapter); localStorage is not.
    return typeof raw === "string" || raw === null ? parseStored(raw) : Promise.resolve(raw).then(parseStored);
  },
  setItem: (name, value) => persistenceAdapter.setItem(name, JSON.stringify(value)),
  removeItem: (name) => persistenceAdapter.removeItem(name),
};

export const useNotesStore = create<NotesState & NotesActions>()(
  persist(
    (set, get) => ({
      notes: {},
      setNote: (slug, text) => {
        const current = get().notes[slug];
        if (!text.trim()) {
          if (!current) return;
          set((s) => {
            const notes = { ...s.notes };
            delete notes[slug];
            return { notes };
          });
          return;
        }
        const next = text.slice(0, NOTE_MAX_LENGTH);
        if (current?.text === next) return;
        set((s) => ({ notes: { ...s.notes, [slug]: { text: next, updatedAt: Date.now() } } }));
      },
      clearNote: (slug) => {
        if (!get().notes[slug]) return;
        set((s) => {
          const notes = { ...s.notes };
          delete notes[slug];
          return { notes };
        });
      },
    }),
    {
      name: STORAGE_KEYS.notes,
      version: 1,
      storage: notesStorage,
      skipHydration: true,
      partialize: (s) => ({ notes: s.notes }),
      merge: (persisted, current) => {
        const p = persisted && typeof persisted === "object" ? (persisted as Partial<Record<keyof PersistedNotes, unknown>>) : {};
        return { ...current, notes: sanitizeNotes(p.notes) };
      },
    },
  ),
);

const subscribeNotesHydration = (callback: () => void) => useNotesStore.persist.onFinishHydration(callback);
const notesHydratedSnapshot = () => useNotesStore.persist.hasHydrated();
const notesHydratedServer = () => false;

/** True once saved notes have loaded on the client. Render note-dependent UI only after this. */
export function useNotesHydrated(): boolean {
  return useSyncExternalStore(subscribeNotesHydration, notesHydratedSnapshot, notesHydratedServer);
}
