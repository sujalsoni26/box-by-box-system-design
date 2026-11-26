/*
 * How each saved store is combined when a learner signs in, and what part of it belongs to one device only.
 * Pure (type imports only), unit tested.
 *
 * Stores are kept exactly as the browser saves them: a JSON envelope `{ state, version }` per store
 * (see stores/*). Merging never loses learning: completed lessons, bookmarks, review flags, quiz attempts,
 * known flashcards and wardrobe unlocks are combined; for each note the most recent edit wins; counters keep
 * the higher value. Settings come from the account. A running focus timer and Cache's spot on the screen stay
 * with the device they belong to and are never uploaded.
 */

export type SyncKey = "progress" | "preferences" | "notes" | "focus";
export const SYNC_KEYS: readonly SyncKey[] = ["progress", "preferences", "notes", "focus"];

type Json = Record<string, unknown>;

export interface Envelope {
  state: Json;
  version: number;
}

const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const obj = (v: unknown): Json => (isObj(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Parse a stored envelope; anything malformed counts as "nothing saved". */
export function parseEnvelope(raw: string | null | undefined): Envelope | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v) || !isObj(v.state)) return null;
    return { state: v.state, version: num(v.version) ?? 0 };
  } catch {
    return null;
  }
}

export function serialize(env: Envelope): string {
  return JSON.stringify({ state: env.state, version: env.version });
}

/* ------------------------------------------------------------------ field helpers */

/** Union of two slug → timestamp maps, keeping the earlier (min) or later (max) time. */
function unionTimes(a: unknown, b: unknown, keep: "min" | "max"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [obj(a), obj(b)]) {
    for (const [k, v] of Object.entries(src)) {
      const t = num(v);
      if (t === undefined || k === "__proto__") continue;
      const cur = out[k];
      out[k] = cur === undefined ? t : keep === "min" ? Math.min(cur, t) : Math.max(cur, t);
    }
  }
  return out;
}

/** Union of two string lists, keeping first-seen order. */
function unionStrings(a: unknown, b: unknown): string[] {
  const seen = new Set<string>();
  for (const v of [...arr(a), ...arr(b)]) if (typeof v === "string") seen.add(v);
  return [...seen];
}

/** Union of number lists per key (known flashcards per deck), sorted. */
function unionNumberLists(a: unknown, b: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const src of [obj(a), obj(b)]) {
    for (const [k, list] of Object.entries(src)) {
      if (k === "__proto__") continue;
      const set = new Set(out[k] ?? []);
      for (const n of arr(list)) if (typeof n === "number" && Number.isInteger(n)) set.add(n);
      out[k] = [...set].sort((x, y) => x - y);
    }
  }
  return out;
}

/** Quiz attempts per check: both sides, de-duplicated by time and score, oldest first, last 10 kept. */
function unionAttempts(a: unknown, b: unknown): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const keys = new Set([...Object.keys(obj(a)), ...Object.keys(obj(b))]);
  for (const k of keys) {
    if (k === "__proto__") continue;
    const byId = new Map<string, Json>();
    for (const at of [...arr(obj(a)[k]), ...arr(obj(b)[k])]) {
      if (!isObj(at)) continue;
      byId.set(`${num(at.completedAt) ?? 0}:${num(at.score) ?? 0}/${num(at.total) ?? 0}`, at);
    }
    out[k] = [...byId.values()].sort((x, y) => (num(x.completedAt) ?? 0) - (num(y.completedAt) ?? 0)).slice(-10);
  }
  return out;
}

/* ------------------------------------------------------------------ per store */

function mergeProgress(l: Json, r: Json): Json {
  const visits = unionTimes(l.visits, r.visits, "max");
  const last = Object.entries(visits).sort((x, y) => y[1] - x[1])[0]?.[0] ?? (l.lastVisited as string | null) ?? null;
  return {
    ...r,
    ...l,
    completed: unionTimes(l.completed, r.completed, "min"),
    visits,
    currentLesson: (l.currentLesson as string | null | undefined) ?? null,
    lastVisited: last,
    quizAttempts: unionAttempts(l.quizAttempts, r.quizAttempts),
    bookmarks: unionStrings(l.bookmarks, r.bookmarks),
    review: unionTimes(l.review, r.review, "min"),
    knownCards: unionNumberLists(l.knownCards, r.knownCards),
  };
}

function mergeNotes(l: Json, r: Json): Json {
  const notes: Record<string, unknown> = {};
  for (const src of [obj(l.notes), obj(r.notes)]) {
    for (const [slug, note] of Object.entries(src)) {
      if (slug === "__proto__" || !isObj(note) || typeof note.text !== "string") continue;
      const cur = notes[slug] as Json | undefined;
      if (!cur || (num(note.updatedAt) ?? 0) > (num(cur.updatedAt) ?? 0)) notes[slug] = note;
    }
  }
  return { ...r, ...l, notes };
}

function mergePreferences(l: Json, r: Json): Json {
  const lc = obj(l.companion);
  const rc = obj(r.companion);
  const ls = obj(lc.stats);
  const rs = obj(rc.stats);
  const stats: Record<string, number> = {};
  for (const k of new Set([...Object.keys(ls), ...Object.keys(rs)])) stats[k] = Math.max(num(ls[k]) ?? 0, num(rs[k]) ?? 0);
  const equippedR = obj(rc.equipped);
  // Profile: the account's answers win field by field; one only this browser has (set as a guest) is kept.
  const lp = obj(l.profile);
  const rp = obj(r.profile);
  const profile: Json = {};
  for (const k of new Set([...Object.keys(lp), ...Object.keys(rp)])) profile[k] = rp[k] !== undefined && rp[k] !== null && rp[k] !== "" ? rp[k] : (lp[k] ?? null);
  return {
    ...l,
    ...r,
    ...(Object.keys(profile).length ? { profile } : {}),
    // The account's settings win; lists and counters are combined.
    theme: r.theme ?? l.theme,
    knownTerms: unionStrings(l.knownTerms, r.knownTerms),
    companion: {
      ...lc,
      ...rc,
      position: lc.position ?? null,
      stats,
      equipped: Object.keys(equippedR).length ? equippedR : obj(lc.equipped),
      announced: unionStrings(lc.announced, rc.announced),
      seenAccessories: unionStrings(lc.seenAccessories, rc.seenAccessories),
      completionAsked: unionTimes(lc.completionAsked, rc.completionAsked, "min"),
    },
  };
}

function mergeFocus(l: Json, r: Json): Json {
  return {
    ...l,
    ...r,
    session: l.session ?? null,
    focusMinutes: num(r.focusMinutes) ?? num(l.focusMinutes),
    sessionsDone: Math.max(num(l.sessionsDone) ?? 0, num(r.sessionsDone) ?? 0),
  };
}

const MERGERS: Record<SyncKey, (l: Json, r: Json) => Json> = {
  progress: mergeProgress,
  notes: mergeNotes,
  preferences: mergePreferences,
  focus: mergeFocus,
};

/**
 * Combine this browser's copy with the account's copy (on sign-in, and when two devices changed the same store
 * at once). Either side may be missing. Returns null only when both are.
 */
export function mergeStored(key: SyncKey, local: string | null, remote: string | null): string | null {
  const l = parseEnvelope(local);
  const r = parseEnvelope(remote);
  if (!l && !r) return null;
  if (!l) return serialize(r!);
  if (!r) return serialize(l);
  return serialize({ state: MERGERS[key](l.state, r.state), version: Math.max(l.version, r.version) });
}

/** What is uploaded: the store without device-only fields (a running timer, the cat's spot on this screen). */
export function forUpload(key: SyncKey, local: string): string {
  const env = parseEnvelope(local);
  if (!env) return local;
  if (key === "focus") return serialize({ ...env, state: { ...env.state, session: null } });
  if (key === "preferences") {
    const c = obj(env.state.companion);
    return serialize({ ...env, state: { ...env.state, companion: { ...c, position: null } } });
  }
  return serialize(env);
}

/** The account's copy, applied to this browser, keeping this device's own fields. */
export function applyRemote(key: SyncKey, local: string | null, remote: string): string {
  const r = parseEnvelope(remote);
  if (!r) return local ?? remote;
  const l = parseEnvelope(local);
  if (key === "focus") return serialize({ ...r, state: { ...r.state, session: l?.state.session ?? null } });
  if (key === "preferences") {
    const rc = obj(r.state.companion);
    const lc = obj(l?.state.companion);
    return serialize({ ...r, state: { ...r.state, companion: { ...rc, position: lc.position ?? null } } });
  }
  return serialize(r);
}

/** Largest upload accepted per store, in characters (mirrors firebase/firestore.rules). */
export const MAX_UPLOAD_CHARS: Record<SyncKey, number> = {
  progress: 300_000,
  preferences: 60_000,
  notes: 900_000,
  focus: 4_000,
};
