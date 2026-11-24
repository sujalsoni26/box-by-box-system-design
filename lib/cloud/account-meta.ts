/*
 * Who the progress in this browser belongs to, and the sync bookkeeping. Pure, unit tested.
 *
 * - A guest (never signed in) owns nothing: the data is theirs and never expires.
 * - Signing in attaches the browser's data to the account (owner = uid). The first sign-in on a browser merges
 *   the local progress into the account, so nothing done as a guest is lost.
 * - Signing out keeps the data here for 5 days (in case it was a mistake), then it is cleared from this browser.
 *   The account's copy is never touched.
 * - If someone else signs in on this browser in the meantime, the local data belongs to the previous account:
 *   it is replaced by the new account's copy, never merged into it.
 */
import type { SyncKey } from "./merge";

export const ACCOUNT_META_KEY = "sdn-account-v1";
/** How long a signed-out account's progress stays in this browser. */
export const SIGNED_OUT_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export interface AccountMeta {
  /** uid of the account the local data belongs to; null for a guest. */
  owner: string | null;
  /** When that account signed out of this browser (null while signed in, or for a guest). */
  signedOutAt: number | null;
  /** Last revision of each store known to be in the account (the database only accepts the next one). */
  revs: Partial<Record<SyncKey, number>>;
  /** Stores changed here since their last successful upload. */
  dirty: Partial<Record<SyncKey, boolean>>;
}

export const EMPTY_META: AccountMeta = { owner: null, signedOutAt: null, revs: {}, dirty: {} };

export function parseMeta(raw: string | null | undefined): AccountMeta {
  if (!raw) return { ...EMPTY_META, revs: {}, dirty: {} };
  try {
    const v = JSON.parse(raw) as Partial<AccountMeta>;
    return {
      owner: typeof v.owner === "string" && v.owner ? v.owner : null,
      signedOutAt: typeof v.signedOutAt === "number" && Number.isFinite(v.signedOutAt) ? v.signedOutAt : null,
      revs: v.revs && typeof v.revs === "object" ? { ...v.revs } : {},
      dirty: v.dirty && typeof v.dirty === "object" ? { ...v.dirty } : {},
    };
  } catch {
    return { ...EMPTY_META, revs: {}, dirty: {} };
  }
}

/** A session is expected to be live: someone signed in here and has not signed out. */
export function hasActiveOwner(meta: AccountMeta): boolean {
  return Boolean(meta.owner) && meta.signedOutAt === null;
}

/**
 * What to do with this browser's data when `uid` signs in:
 * - resume: the same account was already syncing here (normal page load);
 * - merge: guest data, or this account's data from before it signed out: combine with the account's copy;
 * - replace: the data belongs to a different account: drop it and load this account's copy.
 */
export function signInPlan(meta: AccountMeta, uid: string): "resume" | "merge" | "replace" {
  if (!meta.owner) return "merge";
  if (meta.owner !== uid) return "replace";
  return meta.signedOutAt === null ? "resume" : "merge";
}

export function afterSignIn(meta: AccountMeta, uid: string): AccountMeta {
  const same = meta.owner === uid;
  return { owner: uid, signedOutAt: null, revs: same ? { ...meta.revs } : {}, dirty: same ? { ...meta.dirty } : {} };
}

export function afterSignOut(meta: AccountMeta, now: number): AccountMeta {
  return { ...meta, signedOutAt: meta.owner ? now : null, dirty: {} };
}

/** The signed-out account's progress has stayed here for the full TTL: clear it from this browser. */
export function isExpired(meta: AccountMeta, now: number, ttl = SIGNED_OUT_TTL_MS): boolean {
  return Boolean(meta.owner) && meta.signedOutAt !== null && now - meta.signedOutAt >= ttl;
}

/** Time left before a signed-out account's progress is cleared here, ms (null when nothing is scheduled). */
export function timeUntilExpiry(meta: AccountMeta, now: number, ttl = SIGNED_OUT_TTL_MS): number | null {
  if (!meta.owner || meta.signedOutAt === null) return null;
  return Math.max(0, meta.signedOutAt + ttl - now);
}
