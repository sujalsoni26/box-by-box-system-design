/*
 * Accounts in the browser: restores a session, signs in and out, and runs the sync engine for a verified account.
 * Client only (imported by client components). Everything is a no-op when accounts are not configured.
 *
 * Security notes (details in docs/accounts.md):
 * - Sign-in attempts from this browser are throttled (lib/cloud/guards.ts); Firebase enforces the real limits.
 * - Messages never reveal whether an email has an account.
 * - Only accounts with a verified email sync (Google accounts are verified; email accounts after the link).
 * - Deleting the account asks the learner to confirm who they are again, removes the account's copy, the
 *   account itself and this browser's copy.
 */
import type { User } from "firebase/auth";
import { localStorageAdapter, onPersistWrite } from "@/lib/storage/adapter";
import { defaultCompanionSettings, usePreferencesStore } from "@/stores/preferences-store";
import { DEFAULT_FOCUS_MINUTES, useFocusStore } from "@/stores/companion-store";
import { useNotesStore } from "@/stores/notes-store";
import { useProgressStore } from "@/stores/progress-store";
import { useAccountStore, type AccountUser } from "@/stores/account-store";
import { ACCOUNT_META_KEY, afterSignOut, EMPTY_META, hasActiveOwner, parseMeta, timeUntilExpiry, type AccountMeta } from "./account-meta";
import { cloudEnabled } from "./config";
import { clearAccountData, expireIfDue, STORE_STORAGE_KEY } from "./expiry";
import { firestoreBackend, loadFirebase, type FirebaseKit } from "./firebase";
import {
  afterFailure,
  ATTEMPTS_KEY,
  authMessage,
  BASE_PASSWORD_RULES,
  cooldownRemaining,
  countsAsFailure,
  isEmail,
  lockRemaining,
  NO_ATTEMPTS,
  parseAttempts,
  passwordProblems,
  rulesFromPolicy,
  type AuthAction,
  type PasswordRules,
} from "./guards";
import { SYNC_KEYS, type SyncKey } from "./merge";
import { createSyncEngine, type SyncEngine } from "./sync-engine";

const storage = {
  getItem: (k: string) => localStorageAdapter.getItem(k) as string | null,
  setItem: (k: string, v: string) => localStorageAdapter.setItem(k, v),
  removeItem: (k: string) => localStorageAdapter.removeItem(k),
};

const loadMeta = (): AccountMeta => parseMeta(storage.getItem(ACCOUNT_META_KEY));
const saveMeta = (m: AccountMeta) => storage.setItem(ACCOUNT_META_KEY, JSON.stringify(m));
const setAccount = (patch: Partial<ReturnType<typeof useAccountStore.getState>>) => useAccountStore.setState(patch);

const refreshClearsAt = () => {
  const left = timeUntilExpiry(loadMeta(), Date.now());
  setAccount({ clearsAt: left === null ? null : Date.now() + left });
};

/* ------------------------------------------------------------------ this browser's stores */

const STORE_BY_KEY = {
  progress: useProgressStore,
  preferences: usePreferencesStore,
  notes: useNotesStore,
  focus: useFocusStore,
} as const;

function resetStore(key: SyncKey) {
  storage.removeItem(STORE_STORAGE_KEY[key]);
  if (key === "progress") useProgressStore.getState().reset();
  else if (key === "notes") useNotesStore.setState({ notes: {} });
  else if (key === "focus") useFocusStore.setState({ session: null, sessionsDone: 0, focusMinutes: DEFAULT_FOCUS_MINUTES });
  else usePreferencesStore.setState({ knownTerms: [], companion: defaultCompanionSettings });
}

const localSide = {
  get: (key: SyncKey) => storage.getItem(STORE_STORAGE_KEY[key]),
  set: (key: SyncKey, json: string) => storage.setItem(STORE_STORAGE_KEY[key], json),
  reload: (key: SyncKey) => void STORE_BY_KEY[key].persist.rehydrate(),
  reset: resetStore,
};

/* ------------------------------------------------------------------ startup */

/** Before the stores load: clear a signed-out account's copy whose 5 days are up. */
export function prepareLocalData(): void {
  if (!cloudEnabled) return;
  expireIfDue(storage, Date.now());
}

let started = false;
let engine: SyncEngine | null = null;
let connecting: Promise<FirebaseKit> | null = null;

/** After the stores load: restore a session if one is expected, and wire up sync. Safe to call more than once. */
export function initAccounts(): void {
  if (started) return;
  started = true;
  if (!cloudEnabled) {
    setAccount({ phase: "disabled" });
    return;
  }
  refreshClearsAt();
  const meta = loadMeta();
  setAccount({ phase: hasActiveOwner(meta) ? "loading" : "signed-out" });
  if (hasActiveOwner(meta)) void connect().catch(() => setAccount({ phase: "signed-out" }));

  const keyByStorage = new Map<string, SyncKey>(SYNC_KEYS.map((k) => [STORE_STORAGE_KEY[k], k]));
  onPersistWrite((name) => {
    const key = keyByStorage.get(name);
    if (key) engine?.noteLocalWrite(key);
  });
  // Upload pending changes when the tab is hidden or closed; check expiry and verification when it returns.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void engine?.flush();
    else {
      refreshClearsAt();
      if (useAccountStore.getState().phase === "unverified") void checkVerified(true);
    }
  });
  window.addEventListener("pagehide", () => void engine?.flush());
}

/** Load Firebase (once) and follow the session. */
function connect(): Promise<FirebaseKit> {
  if (!connecting) {
    connecting = loadFirebase().then((kit) => {
      engine = createSyncEngine({
        backend: firestoreBackend(kit),
        local: localSide,
        meta: { load: loadMeta, save: saveMeta },
        onStatus: (sync) => setAccount({ sync }),
      });
      kit.a.onAuthStateChanged(kit.auth, (user) => void handleUser(user));
      return kit;
    });
    connecting.catch(() => {
      connecting = null;
    });
  }
  return connecting;
}

function toAccountUser(user: User): AccountUser {
  const google = user.providerData.some((p) => p.providerId === "google.com");
  const password = user.providerData.some((p) => p.providerId === "password");
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    provider: google ? "google" : password ? "password" : "other",
    verified: user.emailVerified || google,
  };
}

async function handleUser(user: User | null): Promise<void> {
  if (!user) {
    if (engine?.uid) engine.stop();
    const meta = loadMeta();
    // Signed out somewhere else (another tab, or the session ended): keep the copy for the TTL, as on sign-out.
    if (hasActiveOwner(meta)) saveMeta(afterSignOut(meta, Date.now()));
    refreshClearsAt();
    setAccount({ phase: "signed-out", user: null });
    return;
  }
  const account = toAccountUser(user);
  if (!account.verified) {
    if (engine?.uid) engine.stop();
    setAccount({ phase: "unverified", user: account });
    return;
  }
  setAccount({ phase: "signed-in", user: account, clearsAt: null });
  if (engine && engine.uid !== user.uid) await engine.start(user.uid);
}

/* ------------------------------------------------------------------ throttled actions */

const continueUrl = () => `${window.location.origin}/progress`;
const readAttempts = () => parseAttempts(storage.getItem(ATTEMPTS_KEY));
const writeAttempts = (s: typeof NO_ATTEMPTS) => storage.setItem(ATTEMPTS_KEY, JSON.stringify(s));

/** Seconds before this browser may try signing in again (0 when it may). */
export function signInLockSeconds(): number {
  return Math.ceil(lockRemaining(readAttempts(), Date.now()) / 1000);
}

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string | null };

async function attempt(action: AuthAction, run: (kit: FirebaseKit) => Promise<void>): Promise<ActionResult> {
  const wait = signInLockSeconds();
  if (wait > 0 && action !== "verify") return { ok: false, message: `Too many attempts. Try again in ${wait} seconds.` };
  try {
    const kit = await connect();
    await run(kit);
    if (action === "sign-in" || action === "sign-up" || action === "google") writeAttempts(NO_ATTEMPTS);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string } | null)?.code ?? "";
    if (countsAsFailure(code)) writeAttempts(afterFailure(readAttempts(), Date.now()));
    const message = authMessage(code, action);
    return { ok: false, message: message === "silent" ? null : message };
  }
}

export function signInWithGoogle(): Promise<ActionResult> {
  return attempt("google", async ({ a, auth }) => {
    const provider = new a.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await a.signInWithPopup(auth, provider);
  });
}

export function signInWithEmail(email: string, password: string): Promise<ActionResult> {
  if (!isEmail(email)) return Promise.resolve({ ok: false, message: "Enter a valid email address." });
  if (!password) return Promise.resolve({ ok: false, message: "Enter your password." });
  return attempt("sign-in", async ({ a, auth }) => {
    await a.signInWithEmailAndPassword(auth, email.trim(), password);
  });
}

const VERIFY_SENT_KEY = "sdn-auth-verify-sent";
const RESET_SENT_KEY = "sdn-auth-reset-sent";
const sentAt = (k: string) => Number(storage.getItem(k)) || 0;

let rulesLoad: Promise<PasswordRules> | null = null;

/** The rules a new password must meet: the site's minimum plus the project's password policy (fetched once). */
export function loadPasswordRules(): Promise<PasswordRules> {
  if (!cloudEnabled) return Promise.resolve(BASE_PASSWORD_RULES);
  rulesLoad ??= connect()
    .then(({ a, auth }) => a.validatePassword(auth, ""))
    .then((status) => rulesFromPolicy(status.passwordPolicy))
    .catch(() => {
      rulesLoad = null; // try again next time; the server still enforces the policy
      return BASE_PASSWORD_RULES;
    });
  return rulesLoad;
}

export async function signUpWithEmail(email: string, password: string): Promise<ActionResult> {
  if (!isEmail(email)) return { ok: false, message: "Enter a valid email address." };
  const problems = passwordProblems(password, await loadPasswordRules());
  if (problems.length) return { ok: false, message: `Your password needs ${problems.join(", ")}.` };
  return attempt("sign-up", async ({ a, auth }) => {
    const status = await a.validatePassword(auth, password).catch(() => null);
    if (status && !status.isValid) throw Object.assign(new Error("policy"), { code: "auth/password-does-not-meet-requirements" });
    const cred = await a.createUserWithEmailAndPassword(auth, email.trim(), password);
    await a.sendEmailVerification(cred.user, { url: continueUrl() });
    storage.setItem(VERIFY_SENT_KEY, String(Date.now()));
  });
}

/** Always reports success, whether or not the email has an account (no account probing). */
export async function sendPasswordReset(email: string): Promise<ActionResult> {
  if (!isEmail(email)) return { ok: false, message: "Enter a valid email address." };
  const wait = Math.ceil(cooldownRemaining(sentAt(RESET_SENT_KEY), Date.now()) / 1000);
  if (wait > 0) return { ok: false, message: `A reset email was just sent. You can send another in ${wait} seconds.` };
  const done: ActionResult = { ok: true, message: "If an account uses that email, a reset link is on its way. Check your inbox (and spam)." };
  const result = await attempt("reset", async ({ a, auth }) => {
    await a.sendPasswordResetEmail(auth, email.trim(), { url: continueUrl() });
  });
  storage.setItem(RESET_SENT_KEY, String(Date.now()));
  if (!result.ok && result.message && /reach|available|Too many/.test(result.message)) return result;
  return done;
}

export async function resendVerification(): Promise<ActionResult> {
  const wait = Math.ceil(cooldownRemaining(sentAt(VERIFY_SENT_KEY), Date.now()) / 1000);
  if (wait > 0) return { ok: false, message: `Email just sent. You can send another in ${wait} seconds.` };
  const result = await attempt("verify", async ({ a, auth }) => {
    if (!auth.currentUser) throw Object.assign(new Error("none"), { code: "auth/user-not-found" });
    await a.sendEmailVerification(auth.currentUser, { url: continueUrl() });
  });
  if (result.ok) storage.setItem(VERIFY_SENT_KEY, String(Date.now()));
  return result.ok ? { ok: true, message: "Verification email sent." } : result;
}

let lastVerifyCheck = 0;

/** After clicking the email link: refresh the account (and its token, so the database sees "verified"). */
export async function checkVerified(quiet = false): Promise<ActionResult> {
  if (quiet && Date.now() - lastVerifyCheck < 10_000) return { ok: true };
  lastVerifyCheck = Date.now();
  try {
    const { auth } = await connect();
    const user = auth.currentUser;
    if (!user) return { ok: false, message: null };
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    await handleUser(auth.currentUser);
    return user.emailVerified ? { ok: true } : { ok: false, message: quiet ? null : "Not verified yet. Open the link in the email, then try again." };
  } catch {
    return { ok: false, message: quiet ? null : "Couldn't check right now. Try again in a moment." };
  }
}

/** Upload anything pending (briefly), stop syncing and sign out. This browser's copy is cleared after 5 days. */
export async function signOutAccount(): Promise<void> {
  const kit = await connect();
  if (engine?.uid) {
    await Promise.race([engine.flush(), new Promise((r) => setTimeout(r, 4_000))]);
    engine.stop();
  }
  const meta = loadMeta();
  if (meta.owner) saveMeta(afterSignOut(meta, Date.now()));
  await kit.a.signOut(kit.auth);
  refreshClearsAt();
  setAccount({ phase: "signed-out", user: null });
}

/**
 * Delete the account: confirm identity again (Google pop-up, or the password), delete the account's copy, the
 * account and this browser's copy.
 */
export async function deleteAccount(password?: string): Promise<ActionResult> {
  return attempt("delete", async (kit) => {
    const { a, auth } = kit;
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error("none"), { code: "auth/user-not-found" });
    const account = toAccountUser(user);
    if (account.provider === "google") await a.reauthenticateWithPopup(user, new a.GoogleAuthProvider());
    else {
      if (!password || !user.email) throw Object.assign(new Error("missing"), { code: "auth/missing-password" });
      await a.reauthenticateWithCredential(user, a.EmailAuthProvider.credential(user.email, password));
    }
    engine?.stop();
    if (account.verified) await firestoreBackend(kit).removeAll(user.uid);
    await a.deleteUser(user);
    clearAccountData(storage);
    for (const key of SYNC_KEYS) resetStore(key);
    saveMeta({ ...EMPTY_META });
    setAccount({ phase: "signed-out", user: null, clearsAt: null });
  });
}

/** Open the dialog, loading Firebase in the background so the first click is quick. */
export function warmUp(): void {
  if (cloudEnabled) void connect().catch(() => {});
}
