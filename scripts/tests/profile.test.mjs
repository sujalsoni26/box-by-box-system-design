// The learner's profile (cleaning, syncing), what Cache calls them, the suggested pace towards a date, the study
// time format and the password messages for "Set a password" / "Change password". Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { appModule } from "./support/load-app.mjs";

const prefs = await appModule("stores/preferences-store.ts");
const merge = await appModule("lib/cloud/merge.ts");
const lines = await appModule("lib/companion/lines.ts");
const pace = await appModule("lib/learning/pace.ts");
const utils = await appModule("lib/utils.ts");
const guards = await appModule("lib/cloud/guards.ts");

const env = (state) => JSON.stringify({ state, version: 1 });

test("profile: cleaned from anything, never sensitive or oversized", () => {
  assert.deepEqual(prefs.cleanProfile(undefined), prefs.emptyProfile);
  const p = prefs.cleanProfile({ name: "  Ada\n  Lovelace ", callMe: "<script>x</script>" + "y".repeat(40), goal: "hack", targetDate: "2026-02-31", phone: "123" });
  assert.equal(p.name, "Ada Lovelace", "trimmed, whitespace collapsed");
  assert.ok(!/[<>]/.test(p.callMe) && p.callMe.length <= prefs.PROFILE_LIMITS.callMe, "no angle brackets, capped");
  assert.equal(p.goal, null, "unknown goal dropped");
  assert.equal(p.targetDate, null, "impossible date dropped");
  assert.ok(!("phone" in p), "unknown fields dropped");
  assert.equal(prefs.cleanProfile({ goal: "interview", targetDate: "2027-01-15" }).targetDate, "2027-01-15");
});

test("profile sync: the account's answers win field by field, a guest's own answers are kept", () => {
  const local = env({ theme: "light", knownTerms: [], companion: {}, profile: { name: "Guest name", callMe: "Boss", goal: "work", targetDate: null } });
  const remote = env({ theme: "dark", knownTerms: [], companion: {}, profile: { name: "Account name", callMe: "", goal: null, targetDate: "2027-03-01" } });
  const p = JSON.parse(merge.mergeStored("preferences", local, remote)).state.profile;
  assert.deepEqual(p, { name: "Account name", callMe: "Boss", goal: "work", targetDate: "2027-03-01" });
  const noProfile = JSON.parse(merge.mergeStored("preferences", env({ theme: "light", companion: {} }), env({ theme: "dark", companion: {} }))).state;
  assert.ok(!("profile" in noProfile), "no empty profile invented");
});

test("Cache calls the learner by their chosen name, or hooman", () => {
  lines.setYouSource(() => "");
  assert.equal(lines.fill("Hi {you}!", {}), "Hi hooman!");
  lines.setYouSource(() => "Captain");
  assert.equal(lines.fill("Hi {you}, {done} done", { done: 3 }), "Hi Captain, 3 done");
  assert.equal(lines.fill("{unknown} stays", {}), "{unknown} stays");
  lines.setYouSource(() => {
    throw new Error("store not ready");
  });
  assert.equal(lines.you(), "hooman");
  lines.setYouSource(() => "Captain");
  for (let i = 0; i < 20; i++) assert.ok(!lines.line("greetBack").includes("{you}"), "line() always fills {you}");
  assert.ok(lines.LINES.signedIn.every((l) => l.includes("{you}")));
});

test("pace: days to the date and a daily share of what is left", () => {
  const now = new Date(2026, 10, 25, 23, 30); // late evening still counts as the 25th
  assert.equal(pace.daysUntil("2026-11-25", now), 0);
  assert.equal(pace.daysUntil("2026-12-05", now), 10);
  assert.equal(pace.daysUntil("2026-11-20", now), -5);
  assert.equal(pace.daysUntil("2026-02-30", now), null);
  assert.equal(pace.daysUntil(null, now), null);
  assert.deepEqual(pace.suggestedPace("2026-12-05", now, { lessons: 25, minutes: 600 }), { days: 10, lessonsPerDay: 3, minutesPerDay: 60 });
  assert.equal(pace.suggestedPace("2026-11-25", now, { lessons: 5, minutes: 50 }), null, "no pace on the day itself");
  assert.equal(pace.suggestedPace("2026-12-05", now, { lessons: 0, minutes: 0 }), null, "nothing left");
  assert.equal(pace.todayIso(now), "2026-11-25");
});

test("study times read naturally", () => {
  assert.equal(utils.formatHours(45), "45 min");
  assert.equal(utils.formatHours(60), "about 1 h");
  assert.equal(utils.formatHours(155), "about 2.5 h");
  assert.equal(utils.formatHours(2244), "about 37.5 h");
});

test("password messages: a wrong current password and an existing password are named plainly", () => {
  assert.equal(guards.authMessage("auth/invalid-credential", "password"), "Your current password is incorrect.");
  assert.match(guards.authMessage("auth/provider-already-linked", "password"), /already has a password/);
  assert.equal(guards.authMessage("auth/invalid-credential", "sign-in"), "The email or password is incorrect.", "sign-in unchanged");
  assert.match(guards.authMessage("auth/email-already-in-use", "password"), /Couldn't add a password/);
});
