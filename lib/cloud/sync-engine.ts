/*
 * Keeps this browser's stores and the signed-in account's copy in step. Framework-free: the cloud, the browser
 * storage and the bookkeeping are passed in, so the whole flow is unit tested against an in-memory fake.
 *
 * Model (one record per store in the account, each with a revision number):
 * - Sign-in on a browser: merge (guest data or this account's own data) or replace (another account's data),
 *   then upload what the account does not have yet.
 * - Page load while signed in ("resume"): the account's copy wins, unless this browser has changes that were
 *   not uploaded yet; those are merged with anything newer in the account and uploaded.
 * - Every local change marks its store dirty and is uploaded a few seconds later (debounced), and right away
 *   when the tab is hidden or closed (flush).
 * - Writes are compare-and-set: the database only accepts revision n+1 over revision n. If another device got
 *   there first, the write is refused; the engine reads the newer copy, merges it in and tries again. A refusal
 *   with no newer revision means this browser wrote too recently (the database rate-limits writes); it waits
 *   and retries.
 */
import { afterSignIn, signInPlan, type AccountMeta } from "./account-meta";
import { applyRemote, forUpload, MAX_UPLOAD_CHARS, mergeStored, SYNC_KEYS, type SyncKey } from "./merge";

export interface RemoteDoc {
  json: string;
  rev: number;
}

export type BackendErrorCode = "denied" | "offline" | "other";

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  constructor(code: BackendErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export interface CloudBackend {
  readAll(uid: string): Promise<Partial<Record<SyncKey, RemoteDoc>>>;
  read(uid: string, key: SyncKey): Promise<RemoteDoc | null>;
  /** Write revision `rev`; rejects with BackendError("denied") if the stored revision is not rev - 1. */
  write(uid: string, key: SyncKey, json: string, rev: number): Promise<void>;
  removeAll(uid: string): Promise<void>;
}

export interface LocalSide {
  /** The store as saved in this browser (JSON envelope), or null. */
  get(key: SyncKey): string | null;
  /** Save a store in this browser without counting it as a local edit. */
  set(key: SyncKey, json: string): void;
  /** Load the saved store into memory (after set). */
  reload(key: SyncKey): void;
  /** Empty a store, in storage and in memory (another account's data). */
  reset(key: SyncKey): void;
}

export interface MetaSide {
  load(): AccountMeta;
  save(meta: AccountMeta): void;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface SyncInfo {
  status: SyncStatus;
  /** Last successful sync, ms. */
  at: number | null;
  /** "too-large", "denied" or "failed" when status is "error". */
  error: string | null;
}

export interface EngineOptions {
  backend: CloudBackend;
  local: LocalSide;
  meta: MetaSide;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  /** Wait after the last local change before uploading, ms. */
  debounceMs?: number;
  /** Wait before retrying a write the database refused as too soon, ms. */
  retryMs?: number;
  /** Wait before retrying while offline, ms. */
  offlineRetryMs?: number;
  onStatus?: (info: SyncInfo) => void;
}

export interface SyncEngine {
  /** Start syncing for `uid` (sign-in, or page load with a signed-in account). */
  start(uid: string): Promise<void>;
  /** A store was saved in this browser by the app. */
  noteLocalWrite(key: SyncKey): void;
  /** Upload pending changes now (tab hidden or closing, before sign-out). */
  flush(): Promise<void>;
  /** Stop syncing (sign-out). Pending uploads are dropped from the schedule. */
  stop(): void;
  /** Delete the account's copy (account deletion). */
  removeRemote(): Promise<void>;
  readonly uid: string | null;
}

export function createSyncEngine(o: EngineOptions): SyncEngine {
  const now = o.now ?? Date.now;
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel = o.cancel ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const debounceMs = o.debounceMs ?? 4_000;
  const retryMs = o.retryMs ?? 3_000;
  const offlineRetryMs = o.offlineRetryMs ?? 15_000;

  let uid: string | null = null;
  let applying = false;
  let restart: unknown = null;
  const timers = new Map<SyncKey, unknown>();
  const chains = new Map<SyncKey, Promise<void>>();
  let info: SyncInfo = { status: "idle", at: null, error: null };

  const emit = (patch: Partial<SyncInfo>) => {
    info = { ...info, ...patch };
    o.onStatus?.(info);
  };
  const wait = (ms: number) => new Promise<void>((resolve) => void schedule(resolve, ms));
  const editMeta = (fn: (m: AccountMeta) => void): AccountMeta => {
    const m = o.meta.load();
    fn(m);
    o.meta.save(m);
    return m;
  };
  const codeOf = (e: unknown): string => (e instanceof BackendError ? e.code : (e as { code?: string })?.code ?? "other");

  /** Put a store into this browser (storage and memory) without it counting as a local edit. */
  const applyLocal = (key: SyncKey, json: string | null) => {
    const current = o.local.get(key);
    if (json === current) return;
    applying = true;
    try {
      if (json === null) o.local.reset(key);
      else {
        o.local.set(key, json);
        o.local.reload(key);
      }
    } finally {
      applying = false;
    }
  };

  const clearTimers = () => {
    timers.forEach((h) => cancel(h));
    timers.clear();
    if (restart !== null) cancel(restart);
    restart = null;
  };

  const later = (key: SyncKey, ms: number) => {
    const t = timers.get(key);
    if (t !== undefined) cancel(t);
    timers.set(
      key,
      schedule(() => {
        timers.delete(key);
        void enqueue(key);
      }, ms),
    );
  };

  /** Uploads of one store run one after another, never overlapping. */
  const enqueue = (key: SyncKey): Promise<void> => {
    const next = (chains.get(key) ?? Promise.resolve()).then(() => upload(key, 0)).catch(() => {});
    chains.set(key, next);
    return next;
  };

  async function upload(key: SyncKey, attempt: number): Promise<void> {
    const id = uid;
    if (!id) return;
    const meta = o.meta.load();
    if (!meta.dirty[key]) return;
    const local = o.local.get(key);
    if (local === null) {
      editMeta((m) => void delete m.dirty[key]);
      return;
    }
    const payload = forUpload(key, local);
    if (payload.length > MAX_UPLOAD_CHARS[key]) {
      emit({ status: "error", error: "too-large" });
      return;
    }
    const known = meta.revs[key] ?? 0;
    emit({ status: "syncing" });
    try {
      await o.backend.write(id, key, payload, known + 1);
      if (uid !== id) return;
      editMeta((m) => {
        m.revs[key] = known + 1;
        // Changed again while uploading: stays dirty (its debounced upload is already scheduled).
        if (o.local.get(key) === local) delete m.dirty[key];
      });
      emit({ status: "synced", at: now(), error: null });
    } catch (e) {
      if (uid !== id) return;
      const code = codeOf(e);
      if (code === "offline") {
        emit({ status: "offline" });
        later(key, offlineRetryMs);
        return;
      }
      if (code === "denied" && attempt < 3) {
        let remote: RemoteDoc | null;
        try {
          remote = await o.backend.read(id, key);
        } catch (e2) {
          if (uid !== id) return;
          if (codeOf(e2) === "offline") {
            emit({ status: "offline" });
            later(key, offlineRetryMs);
          } else emit({ status: "error", error: "failed" });
          return;
        }
        if (uid !== id) return;
        const remoteRev = remote?.rev ?? 0;
        if (remoteRev !== known) {
          // Another device saved first: take its changes in, then try again on top of its revision.
          const merged = mergeStored(key, o.local.get(key), remote?.json ?? null);
          applyLocal(key, merged);
          editMeta((m) => {
            m.revs[key] = remoteRev;
            m.dirty[key] = true;
          });
        } else {
          // Same revision: this browser wrote too recently. Wait, then retry.
          await wait(retryMs);
          if (uid !== id) return;
        }
        return upload(key, attempt + 1);
      }
      emit({ status: "error", error: code === "denied" ? "denied" : "failed" });
    }
  }

  async function start(nextUid: string): Promise<void> {
    clearTimers();
    uid = nextUid;
    emit({ status: "syncing", error: null });
    const before = o.meta.load();
    const plan = signInPlan(before, nextUid);
    let remote: Partial<Record<SyncKey, RemoteDoc>>;
    try {
      remote = await o.backend.readAll(nextUid);
    } catch (e) {
      if (uid !== nextUid) return;
      if (codeOf(e) === "offline") {
        emit({ status: "offline" });
        restart = schedule(() => {
          restart = null;
          if (uid === nextUid) void start(nextUid);
        }, offlineRetryMs);
      } else emit({ status: "error", error: "failed" });
      return;
    }
    if (uid !== nextUid) return;

    const meta = afterSignIn(before, nextUid);
    const uploads: SyncKey[] = [];
    for (const key of SYNC_KEYS) {
      const r = remote[key] ?? null;
      const l = o.local.get(key);
      let next: string | null = l;
      let up = false;
      if (plan === "replace") {
        next = r ? applyRemote(key, null, r.json) : null;
      } else if (plan === "merge") {
        next = mergeStored(key, l, r?.json ?? null);
        up = next !== null && (!r || forUpload(key, next) !== r.json);
      } else if (meta.dirty[key]) {
        // Resume with unsent changes: fold in anything newer from the account, then upload.
        next = r && r.rev !== (meta.revs[key] ?? 0) ? mergeStored(key, l, r.json) : l;
        up = next !== null && (!r || forUpload(key, next) !== r.json);
      } else if (r) {
        // Resume, nothing unsent: the account's copy wins (deletions made elsewhere carry over), except what
        // applyRemote keeps as newer here (a profile saved before syncing started); that is uploaded.
        next = applyRemote(key, l, r.json);
        up = forUpload(key, next) !== r.json;
      } else {
        up = l !== null;
      }
      applyLocal(key, next);
      meta.revs[key] = r?.rev ?? 0;
      if (up) {
        meta.dirty[key] = true;
        uploads.push(key);
      } else delete meta.dirty[key];
    }
    o.meta.save(meta);
    for (const key of uploads) await enqueue(key);
    if (uid === nextUid && info.status === "syncing") emit({ status: "synced", at: now(), error: null });
  }

  return {
    start,
    noteLocalWrite(key) {
      if (!uid || applying) return;
      const meta = o.meta.load();
      if (!meta.dirty[key]) {
        meta.dirty[key] = true;
        o.meta.save(meta);
      }
      later(key, debounceMs);
    },
    async flush() {
      if (!uid) return;
      const meta = o.meta.load();
      const keys = SYNC_KEYS.filter((k) => meta.dirty[k]);
      keys.forEach((k) => {
        const t = timers.get(k);
        if (t !== undefined) cancel(t);
        timers.delete(k);
      });
      await Promise.all(keys.map((k) => enqueue(k)));
    },
    stop() {
      clearTimers();
      uid = null;
      emit({ status: "idle", error: null });
    },
    async removeRemote() {
      if (uid) await o.backend.removeAll(uid);
    },
    get uid() {
      return uid;
    },
  };
}
