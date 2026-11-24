// Accounts and cloud sync: merge rules, sign-in plans, the 5-day expiry, the sign-in guards, and the sync engine
// running two simulated devices against a fake cloud that enforces the same rules as firebase/firestore.rules
// (owner-only, revision n+1 over n, at most one write per store every 2 seconds). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { appModule } from "./support/load-app.mjs";

const merge = await appModule("lib/cloud/merge.ts");
const meta = await appModule("lib/cloud/account-meta.ts");
const expiry = await appModule("lib/cloud/expiry.ts");
const guards = await appModule("lib/cloud/guards.ts");
const engineMod = await appModule("lib/cloud/sync-engine.ts");
const { BackendError, createSyncEngine } = engineMod;

const env = (state, version = 1) => JSON.stringify({ state, version });
const stateOf = (json) => JSON.parse(json).state;
const DAY = 86_400_000;

/* ------------------------------------------------------------------ merge rules */

test("progress merges as a union: nothing learned on either side is lost", () => {
  const local = env({ completed: { dns: 5, http: 9 }, visits: { dns: 5 }, currentLesson: "dns", lastVisited: "dns", quizAttempts: { a: [{ completedAt: 1, score: 2, total: 3 }] }, bookmarks: ["dns"], review: { cdn: 7 }, knownCards: { d1: [3, 1] } });
  const remote = env({ completed: { http: 4, tcp: 2 }, visits: { tcp: 50 }, currentLesson: null, lastVisited: "tcp", quizAttempts: { a: [{ completedAt: 1, score: 2, total: 3 }, { completedAt: 8, score: 3, total: 3 }] }, bookmarks: ["tcp", "dns"], review: { cdn: 3 }, knownCards: { d1: [2], d2: [0] } });
  const s = stateOf(merge.mergeStored("progress", local, remote));
  assert.deepEqual(s.completed, { dns: 5, http: 4, tcp: 2 }, "union, earliest completion");
  assert.deepEqual(s.bookmarks, ["dns", "tcp"]);
  assert.deepEqual(s.review, { cdn: 3 });
  assert.deepEqual(s.knownCards, { d1: [1, 2, 3], d2: [0] });
  assert.equal(s.quizAttempts.a.length, 2, "duplicate attempt counted once");
  assert.equal(s.lastVisited, "tcp", "most recent visit wins");
});

test("notes: the latest edit of each note wins; settings come from the account; counters keep the max", () => {
  const n = stateOf(merge.mergeStored("notes", env({ notes: { a: { text: "old", updatedAt: 1 }, b: { text: "mine", updatedAt: 9 } } }), env({ notes: { a: { text: "new", updatedAt: 5 } } })));
  assert.deepEqual(n.notes, { a: { text: "new", updatedAt: 5 }, b: { text: "mine", updatedAt: 9 } });
  const p = stateOf(
    merge.mergeStored(
      "preferences",
      env({ theme: "light", knownTerms: ["DNS"], companion: { sound: true, position: { x: 0.2, y: 1, floor: true }, stats: { feeds: 9, pets: 1 }, equipped: { neck: "bow-tie" }, announced: ["a"], seenAccessories: ["a"], completionAsked: { x: 5 } } }),
      env({ theme: "dark", knownTerms: ["TCP"], companion: { sound: false, position: null, stats: { feeds: 2, pets: 4 }, equipped: {}, announced: ["b"], seenAccessories: [], completionAsked: { x: 2, y: 3 } } }),
    ),
  );
  assert.equal(p.theme, "dark", "the account's settings win");
  assert.equal(p.companion.sound, false);
  assert.deepEqual(p.knownTerms, ["DNS", "TCP"]);
  assert.deepEqual(p.companion.stats, { feeds: 9, pets: 4 });
  assert.deepEqual(p.companion.equipped, { neck: "bow-tie" }, "keeps local outfit when the account has none");
  assert.deepEqual(p.companion.position, { x: 0.2, y: 1, floor: true }, "the cat's spot stays with the device");
  assert.deepEqual(p.companion.completionAsked, { x: 2, y: 3 });
  const f = stateOf(merge.mergeStored("focus", env({ session: { phase: "focus" }, focusMinutes: 25, sessionsDone: 7 }), env({ session: null, focusMinutes: 50, sessionsDone: 3 })));
  assert.deepEqual(f, { session: { phase: "focus" }, focusMinutes: 50, sessionsDone: 7 });
});

test("device-only fields are never uploaded and are kept when the account's copy is applied", () => {
  const focus = env({ session: { phase: "focus", endsAt: 99 }, focusMinutes: 30, sessionsDone: 2 });
  assert.equal(stateOf(merge.forUpload("focus", focus)).session, null);
  assert.deepEqual(stateOf(merge.applyRemote("focus", focus, env({ session: null, focusMinutes: 45, sessionsDone: 5 }))).session, { phase: "focus", endsAt: 99 });
  const prefs = env({ theme: "light", companion: { position: { x: 0.7, y: 1, floor: true } } });
  assert.equal(stateOf(merge.forUpload("preferences", prefs)).companion.position, null);
  assert.deepEqual(stateOf(merge.applyRemote("preferences", prefs, env({ theme: "dark", companion: { position: null } }))).companion.position, { x: 0.7, y: 1, floor: true });
  assert.equal(merge.mergeStored("progress", null, null), null);
  assert.equal(merge.mergeStored("progress", "not json", env({ completed: { a: 1 } })), env({ completed: { a: 1 } }), "garbage counts as nothing saved");
});

/* ------------------------------------------------------------------ ownership and the 5-day expiry */

test("sign-in plans: merge guest data, resume own session, replace another account's data", () => {
  const guest = meta.parseMeta(null);
  assert.equal(meta.signInPlan(guest, "u1"), "merge");
  const mine = meta.afterSignIn(guest, "u1");
  assert.equal(meta.signInPlan(mine, "u1"), "resume");
  const out = meta.afterSignOut(mine, 1000);
  assert.equal(meta.signInPlan(out, "u1"), "merge", "back on the same account: merge");
  assert.equal(meta.signInPlan(out, "u2"), "replace", "another account: never merge someone else's progress");
  assert.deepEqual(meta.afterSignIn({ ...mine, revs: { progress: 4 } }, "u2").revs, {}, "bookkeeping resets for a new owner");
});

test("signed-out progress stays 5 days, then is cleared (theme kept); guests never expire", () => {
  assert.equal(meta.SIGNED_OUT_TTL_MS, 5 * DAY);
  const store = new Map([
    ["sdn-progress-v1", env({ completed: { dns: 1 } })],
    ["sdn-notes-v1", env({ notes: { dns: { text: "x", updatedAt: 1 } } })],
    ["sdn-focus-v1", env({ sessionsDone: 3 })],
    ["sdn-preferences-v1", env({ theme: "dark", knownTerms: ["DNS"], companion: { sound: true } })],
    [meta.ACCOUNT_META_KEY, JSON.stringify({ owner: "u1", signedOutAt: 1_000, revs: {}, dirty: {} })],
  ]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) };
  assert.equal(expiry.expireIfDue(storage, 1_000 + 5 * DAY - 1), false, "not before 5 days");
  assert.ok(store.has("sdn-progress-v1"));
  assert.equal(expiry.expireIfDue(storage, 1_000 + 5 * DAY), true);
  assert.ok(!store.has("sdn-progress-v1") && !store.has("sdn-notes-v1") && !store.has("sdn-focus-v1"));
  assert.deepEqual(stateOf(store.get("sdn-preferences-v1")), { theme: "dark" });
  assert.equal(meta.parseMeta(store.get(meta.ACCOUNT_META_KEY)).owner, null);
  // A guest (no owner) never expires.
  store.set(meta.ACCOUNT_META_KEY, JSON.stringify({ owner: null, signedOutAt: null, revs: {}, dirty: {} }));
  store.set("sdn-progress-v1", env({ completed: { a: 1 } }));
  assert.equal(expiry.expireIfDue(storage, 10 ** 13), false);
  assert.equal(meta.timeUntilExpiry({ owner: "u", signedOutAt: 0, revs: {}, dirty: {} }, DAY), 4 * DAY);
});

/* ------------------------------------------------------------------ sign-in guards */

test("throttle: three free attempts, then 15 s, 30 s, 60 s … capped at 15 minutes", () => {
  let s = guards.NO_ATTEMPTS;
  for (let i = 0; i < 2; i += 1) s = guards.afterFailure(s, 0);
  assert.equal(guards.lockRemaining(s, 0), 0);
  s = guards.afterFailure(s, 0);
  assert.equal(guards.lockRemaining(s, 0), 15_000);
  s = guards.afterFailure(s, 0);
  assert.equal(guards.lockRemaining(s, 0), 30_000);
  for (let i = 0; i < 10; i += 1) s = guards.afterFailure(s, 0);
  assert.equal(guards.lockRemaining(s, 0), 15 * 60_000);
  assert.deepEqual(guards.parseAttempts("garbage"), guards.NO_ATTEMPTS);
  assert.equal(guards.cooldownRemaining(1_000, 31_000), 30_000);
});

test("validation and messages: strong passwords, no account probing", () => {
  assert.ok(guards.isEmail("a.b@example.co"));
  for (const bad of ["", "a@b", "a b@c.de", "@x.io", `${"a".repeat(250)}@x.io`]) assert.ok(!guards.isEmail(bad), bad);
  assert.deepEqual(guards.passwordProblems("Abcdefg1"), []);
  assert.ok(guards.passwordProblems("abcdefgh").length >= 2);
  // Wrong password and unknown email read the same, so nobody can tell which emails have accounts.
  assert.equal(guards.authMessage("auth/user-not-found", "sign-in"), guards.authMessage("auth/wrong-password", "sign-in"));
  assert.equal(guards.authMessage("auth/invalid-credential", "sign-in"), guards.authMessage("auth/user-not-found", "sign-in"));
  assert.equal(guards.authMessage("auth/popup-closed-by-user", "google"), "silent");
  assert.ok(guards.countsAsFailure("auth/invalid-credential") && !guards.countsAsFailure("auth/network-request-failed"));
});

/* ------------------------------------------------------------------ sync engine, two devices, one fake cloud */

function makeCloud(clock) {
  const docs = new Map(); // `${uid}/${key}` -> { json, rev, updatedAt }
  let offline = false;
  const check = () => {
    if (offline) throw new BackendError("offline");
  };
  return {
    docs,
    setOffline: (v) => (offline = v),
    get: (uid, key) => docs.get(`${uid}/${key}`) ?? null,
    backend: {
      async readAll(uid) {
        check();
        const out = {};
        for (const [k, d] of docs) if (k.startsWith(`${uid}/`)) out[k.split("/")[1]] = { json: d.json, rev: d.rev };
        return out;
      },
      async read(uid, key) {
        check();
        const d = docs.get(`${uid}/${key}`);
        return d ? { json: d.json, rev: d.rev } : null;
      },
      async write(uid, key, json, rev) {
        check();
        const cur = docs.get(`${uid}/${key}`);
        if (rev !== (cur?.rev ?? 0) + 1) throw new BackendError("denied"); // compare-and-set
        if (cur && clock.now - cur.updatedAt <= 2_000) throw new BackendError("denied"); // rate limit
        if (json.length > merge.MAX_UPLOAD_CHARS[key]) throw new BackendError("denied");
        docs.set(`${uid}/${key}`, { json, rev, updatedAt: clock.now });
      },
      async removeAll(uid) {
        check();
        for (const k of [...docs.keys()]) if (k.startsWith(`${uid}/`)) docs.delete(k);
      },
    },
  };
}

function makeClock() {
  const tasks = [];
  const clock = {
    now: 1_000_000,
    schedule(fn, ms) {
      const t = { at: clock.now + ms, fn };
      tasks.push(t);
      return t;
    },
    cancel(t) {
      const i = tasks.indexOf(t);
      if (i >= 0) tasks.splice(i, 1);
    },
    async settle() {
      for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
    },
    async advance(ms) {
      const end = clock.now + ms;
      for (;;) {
        await clock.settle();
        tasks.sort((a, b) => a.at - b.at);
        const next = tasks[0];
        if (!next || next.at > end) break;
        tasks.shift();
        clock.now = Math.max(clock.now, next.at);
        next.fn();
      }
      clock.now = end;
      await clock.settle();
    },
  };
  return clock;
}

function makeDevice(cloud, clock) {
  const storage = new Map();
  let metaRaw = null;
  const statuses = [];
  const device = {
    storage,
    statuses,
    reloads: 0,
    get: (key) => storage.get(key) ?? null,
    meta: () => meta.parseMeta(metaRaw),
    /** The app saving a store (counts as a local edit). */
    edit(key, state) {
      storage.set(key, env(state));
      device.engine.noteLocalWrite(key);
    },
    state: (key) => (storage.get(key) ? stateOf(storage.get(key)) : null),
  };
  device.engine = createSyncEngine({
    backend: cloud.backend,
    local: {
      get: (k) => storage.get(k) ?? null,
      set: (k, json) => void storage.set(k, json),
      reload: () => void (device.reloads += 1),
      reset: (k) => void storage.delete(k),
    },
    meta: { load: () => meta.parseMeta(metaRaw), save: (m) => void (metaRaw = JSON.stringify(m)) },
    now: () => clock.now,
    schedule: clock.schedule,
    cancel: clock.cancel,
    debounceMs: 4_000,
    retryMs: 3_000,
    offlineRetryMs: 15_000,
    onStatus: (s) => statuses.push(s.status),
  });
  device.signOut = () => {
    device.engine.stop();
    metaRaw = JSON.stringify(meta.afterSignOut(meta.parseMeta(metaRaw), clock.now));
  };
  return device;
}

test("first sign-in uploads guest progress; a second device gets it merged with its own", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const laptop = makeDevice(cloud, clock);
  laptop.storage.set("progress", env({ completed: { dns: 1 }, bookmarks: ["dns"] }));
  laptop.storage.set("notes", env({ notes: { dns: { text: "resolver chain", updatedAt: 5 } } }));
  await laptop.engine.start("u1");
  assert.deepEqual(stateOf(cloud.get("u1", "progress").json).completed, { dns: 1 }, "guest progress is in the account");
  assert.equal(cloud.get("u1", "notes").rev, 1);
  assert.equal(laptop.meta().owner, "u1");

  clock.now += 10_000;
  const phone = makeDevice(cloud, clock);
  phone.storage.set("progress", env({ completed: { tcp: 2 }, bookmarks: [] }));
  await phone.engine.start("u1");
  assert.deepEqual(phone.state("progress").completed, { dns: 1, tcp: 2 }, "phone has both");
  assert.equal(phone.state("notes").notes.dns.text, "resolver chain", "notes arrive on the new device");
  assert.deepEqual(stateOf(cloud.get("u1", "progress").json).completed, { dns: 1, tcp: 2 }, "account has both");
});

test("edits upload after the debounce; a deletion on one device is not undone by another", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const a = makeDevice(cloud, clock);
  a.storage.set("progress", env({ completed: { dns: 1 }, bookmarks: ["dns", "tcp"] }));
  await a.engine.start("u1");
  clock.now += 5_000;
  const b = makeDevice(cloud, clock);
  await b.engine.start("u1");
  assert.deepEqual(b.state("progress").bookmarks, ["dns", "tcp"]);

  a.edit("progress", { completed: { dns: 1 }, bookmarks: ["dns"] }); // remove a bookmark
  await clock.advance(3_000);
  assert.deepEqual(stateOf(cloud.get("u1", "progress").json).bookmarks, ["dns", "tcp"], "not before the debounce");
  await clock.advance(2_000);
  assert.deepEqual(stateOf(cloud.get("u1", "progress").json).bookmarks, ["dns"], "uploaded after the debounce");
  assert.equal(a.meta().dirty.progress, undefined);

  // Device B reloads the page (resume): the account's copy wins; the bookmark stays removed.
  b.engine.stop();
  clock.now += 5_000;
  await b.engine.start("u1");
  assert.deepEqual(b.state("progress").bookmarks, ["dns"]);
});

test("two devices saving at once: the second write is refused, merged and retried (no lost update)", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const a = makeDevice(cloud, clock);
  const b = makeDevice(cloud, clock);
  a.storage.set("progress", env({ completed: { dns: 1 } }));
  await a.engine.start("u1");
  clock.now += 3_000;
  await b.engine.start("u1");
  clock.now += 3_000;
  a.edit("progress", { completed: { dns: 1, http: 2 } });
  b.edit("progress", { completed: { dns: 1, tcp: 3 } });
  await clock.advance(4_000); // both debounces fire together: one wins, the other must merge and retry
  await clock.advance(10_000);
  const final = stateOf(cloud.get("u1", "progress").json).completed;
  assert.deepEqual(final, { dns: 1, http: 2, tcp: 3 }, "both edits survive");
  assert.ok(b.state("progress").completed.http || a.state("progress").completed.tcp, "the retrying device took the other's edit in");
});

test("too-fast writes are retried after the rate limit; offline saves wait and then go through", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const a = makeDevice(cloud, clock);
  a.storage.set("notes", env({ notes: {} }));
  await a.engine.start("u1");
  a.edit("notes", { notes: { a: { text: "1", updatedAt: 1 } } });
  const flushed = a.engine.flush(); // immediate write, within 2 s of the first: refused, then retried after 3 s
  await clock.advance(4_000);
  await flushed;
  assert.equal(stateOf(cloud.get("u1", "notes").json).notes.a.text, "1");

  cloud.setOffline(true);
  clock.now += 5_000;
  a.edit("notes", { notes: { a: { text: "2", updatedAt: 2 } } });
  await clock.advance(4_000);
  assert.ok(a.statuses.includes("offline"));
  assert.equal(stateOf(cloud.get("u1", "notes").json).notes.a.text, "1");
  cloud.setOffline(false);
  await clock.advance(16_000);
  assert.equal(stateOf(cloud.get("u1", "notes").json).notes.a.text, "2", "saved once back online");
  assert.equal(a.statuses.at(-1), "synced");
});

test("another account on the same browser never receives the previous account's progress", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const shared = makeDevice(cloud, clock);
  shared.storage.set("progress", env({ completed: { secret: 1 } }));
  await shared.engine.start("alice");
  shared.signOut();
  clock.now += DAY;
  await shared.engine.start("bob");
  assert.equal(shared.state("progress"), null, "Alice's progress is not shown to Bob");
  assert.equal(cloud.get("bob", "progress"), null, "and not uploaded into Bob's account");
  assert.deepEqual(stateOf(cloud.get("alice", "progress").json).completed, { secret: 1 }, "Alice's account keeps it");
});

test("signed out: nothing uploads; device-only fields never reach the account; oversized notes are refused", async () => {
  const clock = makeClock();
  const cloud = makeCloud(clock);
  const a = makeDevice(cloud, clock);
  a.storage.set("focus", env({ session: { phase: "focus" }, focusMinutes: 25, sessionsDone: 1 }));
  await a.engine.start("u1");
  assert.equal(stateOf(cloud.get("u1", "focus").json).session, null, "running timer stays on the device");
  a.signOut();
  a.edit("focus", { session: null, focusMinutes: 50, sessionsDone: 2 });
  await clock.advance(10_000);
  assert.equal(stateOf(cloud.get("u1", "focus").json).focusMinutes, 25, "no upload after sign-out");
  assert.ok(a.meta().signedOutAt, "sign-out recorded for the 5-day expiry");

  await a.engine.start("u1");
  clock.now += 5_000;
  a.edit("notes", { notes: { big: { text: "x".repeat(merge.MAX_UPLOAD_CHARS.notes + 10), updatedAt: 1 } } });
  await clock.advance(5_000);
  assert.equal(a.statuses.at(-1), "error");
  assert.equal(cloud.get("u1", "notes"), null, "nothing oversized is sent");
});
