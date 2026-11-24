import type { StateStorage } from "zustand/middleware";

/**
 * Persistence boundary for every store. Today it is localStorage; later an authenticated
 * server adapter can implement the same (optionally async) interface without touching the UI.
 */
export type PersistenceAdapter = StateStorage;

const memory = new Map<string, string>();

/** localStorage with a silent in-memory fallback (private mode, blocked storage). */
export const localStorageAdapter: PersistenceAdapter = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      memory.set(name, value);
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      memory.delete(name);
    }
  },
};

type WriteListener = (key: string) => void;
const writeListeners = new Set<WriteListener>();

/**
 * Be told whenever the app saves (or removes) a store. Cloud sync uses this to upload changes for a signed-in
 * learner; it writes back through `localStorageAdapter` directly, which does not notify.
 */
export function onPersistWrite(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

/** The adapter the app uses: browser storage, with change notifications for cloud sync. */
export const persistenceAdapter: PersistenceAdapter = {
  getItem: (name) => localStorageAdapter.getItem(name),
  setItem(name, value) {
    localStorageAdapter.setItem(name, value);
    writeListeners.forEach((fn) => fn(name));
  },
  removeItem(name) {
    localStorageAdapter.removeItem(name);
    writeListeners.forEach((fn) => fn(name));
  },
};

export const STORAGE_KEYS = {
  progress: "sdn-progress-v1",
  preferences: "sdn-preferences-v1",
  focus: "sdn-focus-v1",
  notes: "sdn-notes-v1",
} as const;
