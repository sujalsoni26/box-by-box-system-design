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

/** What a new password must contain: this site's minimum, plus anything the Firebase project's policy adds. */
export interface PasswordRules {
  minLength: number;
  maxLength: number;
  symbol: boolean;
  /** Characters that count as symbols (the policy's list); empty means any character that isn't A–Z, a–z or 0–9. */
  symbols: string;
}

/** The site's minimum: 8+ characters with upper and lower case letters and a number. */
export const BASE_PASSWORD_RULES: PasswordRules = { minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, symbol: false, symbols: "" };

/** The parts of Firebase's `PasswordPolicy` that matter here. */
export interface PolicyLike {
  enforcementState?: string;
  allowedNonAlphanumericCharacters?: string;
  customStrengthOptions?: { minPasswordLength?: number; maxPasswordLength?: number; containsNonAlphanumericCharacter?: boolean };
}

/** Combine the site's minimum with the project's password policy (when enforced). Never weaker than the minimum. */
export function rulesFromPolicy(policy: PolicyLike | null | undefined): PasswordRules {
  if (!policy || policy.enforcementState !== "ENFORCE") return BASE_PASSWORD_RULES;
  const o = policy.customStrengthOptions ?? {};
  return {
    minLength: Math.max(PASSWORD_MIN, o.minPasswordLength ?? 0),
    maxLength: Math.min(PASSWORD_MAX, o.maxPasswordLength ?? PASSWORD_MAX),
    symbol: o.containsNonAlphanumericCharacter === true,
    symbols: policy.allowedNonAlphanumericCharacters ?? "",
  };
}

const hasSymbol = (pw: string, symbols: string) => [...pw].some((c) => (symbols ? symbols.includes(c) : /[^A-Za-z0-9]/.test(c)));

/** Each rule with whether the password meets it, in the order the sign-up form lists them. */
export function passwordChecks(pw: string, rules: PasswordRules = BASE_PASSWORD_RULES): { label: string; need: string; ok: boolean }[] {
  const checks = [
    { label: `At least ${rules.minLength} characters`, need: `at least ${rules.minLength} characters`, ok: pw.length >= rules.minLength },
    { label: "Upper and lower case letters", need: "upper and lower case letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "A number", need: "a number", ok: /[0-9]/.test(pw) },
  ];
  if (rules.symbol) checks.push({ label: "A symbol, such as ! @ # $", need: "a symbol", ok: hasSymbol(pw, rules.symbols) });
  return checks;
}

/** Requirements a new password does not meet yet (empty when it is acceptable). */
export function passwordProblems(pw: string, rules: PasswordRules = BASE_PASSWORD_RULES): string[] {
  const out = passwordChecks(pw, rules)
    .filter((c) => !c.ok)
    .map((c) => c.need);
  if (pw.length > rules.maxLength) out.push(`at most ${rules.maxLength} characters`);
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
      return "Choose a stronger password that meets every rule listed under the password box.";
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
