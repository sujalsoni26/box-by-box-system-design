/*
 * Client-side guards for the sign-in form. Pure, unit tested.
 *
 * These slow down guessing and accidental hammering from this browser; they are not the security boundary.
 * The server side enforces the real limits: Firebase Authentication throttles repeated failures
 * ("too-many-requests"), applies the project's password policy and email-enumeration protection, and the
 * database rules only let a verified owner read or write their own records, at a limited rate (see
 * firebase/firestore.rules and docs/accounts.md).
 */

/* ------------------------------------------------------------------ attempt throttle */

export const ATTEMPTS_KEY = "sdn-auth-attempts";
/** Free attempts before a lock-out starts. */
export const FREE_ATTEMPTS = 3;
const BASE_LOCK_MS = 15_000;
const MAX_LOCK_MS = 15 * 60_000;

export interface AttemptState {
  /** Consecutive failures (any sign-in method). */
  fails: number;
  /** No attempt allowed before this time, ms. */
  lockedUntil: number;
}

export const NO_ATTEMPTS: AttemptState = { fails: 0, lockedUntil: 0 };

export function parseAttempts(raw: string | null | undefined): AttemptState {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<AttemptState>) : null;
    const fails = typeof v?.fails === "number" && v.fails >= 0 ? Math.floor(v.fails) : 0;
    const lockedUntil = typeof v?.lockedUntil === "number" && Number.isFinite(v.lockedUntil) ? v.lockedUntil : 0;
    return { fails, lockedUntil };
  } catch {
    return { ...NO_ATTEMPTS };
  }
}

/** After a failed attempt: the first few are free, then 15 s, 30 s, 60 s … up to 15 minutes. */
export function afterFailure(s: AttemptState, now: number): AttemptState {
  const fails = s.fails + 1;
  const over = fails - FREE_ATTEMPTS;
  const lock = over >= 0 ? Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** over) : 0;
  return { fails, lockedUntil: lock ? now + lock : 0 };
}

export function lockRemaining(s: AttemptState, now: number): number {
  return Math.max(0, s.lockedUntil - now);
}

/* ------------------------------------------------------------------ email cooldowns */

/** Minimum gap between verification or reset emails from this browser, ms. */
export const EMAIL_COOLDOWN_MS = 60_000;

export function cooldownRemaining(lastAt: number | null | undefined, now: number, ms = EMAIL_COOLDOWN_MS): number {
  return lastAt ? Math.max(0, lastAt + ms - now) : 0;
}

/* ------------------------------------------------------------------ input validation */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** A practical email check (the server is the authority): one @, a dot in the domain, no spaces, ≤ 254 chars. */
export function isEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Requirements a new password does not meet yet (empty when it is acceptable). */
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < PASSWORD_MIN) out.push(`at least ${PASSWORD_MIN} characters`);
  if (pw.length > PASSWORD_MAX) out.push(`at most ${PASSWORD_MAX} characters`);
  if (!/[a-z]/.test(pw)) out.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) out.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) out.push("a number");
  return out;
}

/* ------------------------------------------------------------------ messages */

export type AuthAction = "sign-in" | "sign-up" | "google" | "reset" | "verify" | "delete";

/**
 * A short, safe message for a Firebase error code. Never says whether an email has an account (that would let
 * someone probe for accounts); "silent" means the learner cancelled and nothing should be shown.
 */
export function authMessage(code: string, action: AuthAction): string | "silent" {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "silent";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return action === "sign-up" ? "Enter a valid email address." : "The email or password is incorrect.";
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
      return "Couldn't create the account with that email. If you already have one, sign in (or reset your password).";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password: at least 8 characters with upper and lower case letters and a number.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    case "auth/network-request-failed":
      return "Can't reach the sign-in service. Check your connection and try again.";
    case "auth/unauthorized-domain":
    case "auth/operation-not-allowed":
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Sign-in isn't available on this site right now.";
    case "auth/requires-recent-login":
      return "For your security, sign in again to do this.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/missing-password":
      return "Enter your password.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Errors that count as a failed guess for the throttle (not cancellations or connection trouble). */
export function countsAsFailure(code: string): boolean {
  return [
    "auth/invalid-credential",
    "auth/invalid-login-credentials",
    "auth/wrong-password",
    "auth/user-not-found",
    "auth/too-many-requests",
    "auth/email-already-in-use",
  ].includes(code);
}
