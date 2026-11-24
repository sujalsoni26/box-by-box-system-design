/*
 * Clearing a signed-out account's progress from this browser after the TTL (5 days), or right away when the
 * account is deleted. Runs before the stores load, so nothing stale is ever shown. Unit tested with an
 * in-memory storage.
 */
import { STORAGE_KEYS } from "@/lib/storage/adapter";
import { ACCOUNT_META_KEY, EMPTY_META, isExpired, parseMeta } from "./account-meta";
import { parseEnvelope, serialize, type SyncKey } from "./merge";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Browser storage key of each synced store. */
export const STORE_STORAGE_KEY: Record<SyncKey, string> = {
  progress: STORAGE_KEYS.progress,
  preferences: STORAGE_KEYS.preferences,
  notes: STORAGE_KEYS.notes,
  focus: STORAGE_KEYS.focus,
};

/**
 * Remove an account's learning data from this browser: progress, notes, focus stats, glossary hints and
 * Cache's wardrobe and settings. The theme is a property of the device and stays.
 */
export function clearAccountData(storage: KeyValueStorage): void {
  storage.removeItem(STORAGE_KEYS.progress);
  storage.removeItem(STORAGE_KEYS.notes);
  storage.removeItem(STORAGE_KEYS.focus);
  const prefs = parseEnvelope(storage.getItem(STORAGE_KEYS.preferences));
  if (prefs) {
    const theme = prefs.state.theme;
    storage.setItem(STORAGE_KEYS.preferences, serialize({ version: prefs.version, state: theme ? { theme } : {} }));
  }
  storage.setItem(ACCOUNT_META_KEY, JSON.stringify(EMPTY_META));
}

/** Clear the browser copy if its signed-out owner's TTL has passed. Returns true when it cleared. */
export function expireIfDue(storage: KeyValueStorage, now: number): boolean {
  const meta = parseMeta(storage.getItem(ACCOUNT_META_KEY));
  if (!isExpired(meta, now)) return false;
  clearAccountData(storage);
  return true;
}
