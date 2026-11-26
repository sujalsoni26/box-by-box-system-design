"use client";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addPassword,
  changePassword,
  checkVerified,
  deleteAccount,
  loadPasswordRules,
  resendVerification,
  sendPasswordReset,
  signInLockSeconds,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
  warmUp,
  type ActionResult,
} from "@/lib/cloud/controller";
import { BASE_PASSWORD_RULES, passwordChecks, passwordProblems, type PasswordRules } from "@/lib/cloud/guards";
import { welcomeSignedIn as welcome } from "@/lib/companion/reactions";
import { useBackdropDismiss } from "@/lib/hooks/use-backdrop-dismiss";
import { cn } from "@/lib/utils";
import { useAccountStore, type AccountView } from "@/stores/account-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { ProfileForm } from "./profile-form";
import { SyncStatusLine } from "./sync-status";

const TITLES: Record<AccountView, string> = {
  "sign-in": "Sign in to save your progress",
  "sign-up": "Create an account",
  reset: "Reset your password",
  verify: "Verify your email",
  account: "Your account",
  password: "Password",
  profile: "Your profile",
};

/** Views that are steps towards signing in: once the learner is signed in, they have done their job. */
const SIGN_IN_STEPS: readonly AccountView[] = ["sign-in", "sign-up", "reset", "verify"];

/**
 * Sign-in, sign-up, password reset, email verification, the account, password and profile views, in one native
 * modal dialog (focus is trapped, Escape closes, focus returns to the opener). Opened through the account store.
 */
export function AccountDialog() {
  const view = useAccountStore((s) => s.view);
  const phase = useAccountStore((s) => s.phase);
  const close = useAccountStore((s) => s.closeDialog);
  const open = useAccountStore((s) => s.openDialog);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const user = useAccountStore((s) => s.user);
  const lastPhase = useRef(phase);
  const backdrop = useBackdropDismiss(() => ref.current?.close());

  // Signing in finishes the job: close the dialog and let Cache say hello. An email account that still has to
  // verify its address goes on to the "verify" step instead.
  useEffect(() => {
    const before = lastPhase.current;
    lastPhase.current = phase;
    if (phase === before || !view) return;
    if (phase === "signed-in" && SIGN_IN_STEPS.includes(view)) {
      close();
      welcome();
    } else if (phase === "unverified" && (view === "sign-in" || view === "sign-up")) open("verify");
  }, [phase, view, close, open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (view && !d.open) {
      d.showModal();
      // Load Firebase now (whichever button opened the dialog), so the Google button can open its pop-up while the
      // click is still being handled; strict browsers (Safari, mobile) block pop-ups opened after a download.
      warmUp();
    }
    if (!view && d.open) d.close();
  }, [view]);

  return (
    <dialog
      ref={ref}
      {...backdrop}
      aria-labelledby={titleId}
      data-testid="account-dialog"
      data-view={view ?? ""}
      data-companion-avoid=""
      onClose={close}
      onCancel={close}
      onKeyDown={(e) => {
        // Keep Tab inside the dialog (the page behind is inert, but Tab could otherwise leave for the browser UI).
        if (e.key !== "Tab") return;
        const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, input, a[href], [tabindex]:not([tabindex='-1'])")].filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/40"
    >
      {view ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              {(view === "profile" || view === "password") && (phase === "signed-in" || phase === "unverified") ? (
                <button
                  type="button"
                  onClick={() => open("account")}
                  aria-label="Back to your account"
                  data-testid="account-back"
                  className="-ml-2 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </button>
              ) : null}
              <h2 id={titleId} className="font-display text-xl font-bold leading-tight">
                {view === "password" && user ? (user.hasPassword ? "Change password" : "Set a password") : TITLES[view]}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              data-testid="account-close"
              className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="mt-4">
            {view === "sign-in" ? <SignIn /> : null}
            {view === "sign-up" ? <SignUp /> : null}
            {view === "reset" ? <Reset /> : null}
            {view === "verify" ? <Verify /> : null}
            {view === "account" ? <Account /> : null}
            {view === "password" ? <PasswordView /> : null}
            {view === "profile" ? (
              <ProfileForm inDialog onDone={() => (phase === "signed-in" || phase === "unverified" ? open("account") : close())} />
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/* ------------------------------------------------------------------ shared bits */

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) setNote(r.message ?? null);
    else setError(r.message);
    return r;
  };
  return { busy, error, note, run, setError };
}

function Feedback({ error, note }: { error: string | null; note: string | null }) {
  return (
    <>
      <p role="alert" data-testid="account-error" className={cn("text-sm font-semibold text-bad", !error && "sr-only")}>
        {error}
      </p>
      <p role="status" data-testid="account-note" className={cn("text-sm text-good", !note && "sr-only")}>
        {note}
      </p>
    </>
  );
}

function Field({ label, children, hint, hintId }: { label: string; children: ReactNode; hint?: ReactNode; hintId?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-2">
      {label}
      {children}
      {hint ? (
        <span id={hintId} className="font-normal text-ink-3">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base font-normal text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  describedBy?: string;
  testId: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex">
      <input
        type={show ? "text" : "password"}
        required={props.required ?? true}
        maxLength={128}
        autoComplete={props.autoComplete}
        aria-describedby={props.describedBy}
        data-testid={props.testId}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={cn(inputClass, "pr-12")}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:text-ink"
      >
        {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </span>
  );
}

function GoogleButton({ onDone }: { onDone: (r: ActionResult) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      className="w-full"
      disabled={busy}
      data-testid="account-google"
      onClick={async () => {
        setBusy(true);
        onDone(await signInWithGoogle());
        setBusy(false);
      }}
    >
      <GoogleLogo />
      {busy ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}

/** Google's four-colour "G", as Google's sign-in branding guidelines ask for on a "Continue with Google" button. */
function GoogleLogo({ small = false }: { small?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={cn("shrink-0", small ? "size-3" : "size-5")}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Privacy() {
  return (
    <p className="mt-4 text-xs leading-relaxed text-ink-3">
      Optional. Your email and learning progress are kept in Google Firebase (India) only to sync them between your devices.
      Without an account, everything stays in this browser. You can delete the account and its data at any time.
    </p>
  );
}

/** Live countdown while this browser is locked out after repeated failures; `refresh` after each attempt. */
function useLock(): [number, () => void] {
  const [left, setLeft] = useState(() => signInLockSeconds());
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setInterval(() => setLeft(signInLockSeconds()), 1000);
    return () => window.clearInterval(id);
  }, [left]);
  return [left, () => setLeft(signInLockSeconds())];
}

/* ------------------------------------------------------------------ views */

function SignIn() {
  const open = useAccountStore((s) => s.openDialog);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, note, run, setError } = useAction();
  const [lock, refreshLock] = useLock();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => signInWithEmail(email, password));
    refreshLock();
  };

  return (
    <div>
      <GoogleButton
        onDone={(r) => {
          if (!r.ok) setError(r.message);
          refreshLock();
        }}
      />
      <Divider />
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label="Email">
          <input type="email" required autoComplete="email" inputMode="email" maxLength={254} data-testid="account-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" testId="account-password" />
        </Field>
        <Feedback error={lock > 0 ? `Too many attempts. Try again in ${lock} seconds.` : error} note={note} />
        <Button type="submit" variant="primary" disabled={busy || lock > 0} data-testid="account-submit">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="font-bold text-link underline underline-offset-2" onClick={() => open("reset")}>
          Forgot password?
        </button>
        <button type="button" className="font-bold text-link underline underline-offset-2" onClick={() => open("sign-up")} data-testid="account-to-sign-up">
          Create an account
        </button>
      </div>
      <Privacy />
    </div>
  );
}

/** The project's password rules (the site's minimum until they load), so the list matches what Firebase enforces. */
function usePasswordRules(): PasswordRules {
  const [rules, setRules] = useState(BASE_PASSWORD_RULES);
  useEffect(() => {
    let live = true;
    void loadPasswordRules().then((r) => {
      if (live) setRules(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return rules;
}

/** The password rules as a live checklist under a new-password box. */
function RulesList({ password, policy }: { password: string; policy: PasswordRules }) {
  return (
    <ul className="mt-0.5 space-y-0.5">
      {passwordChecks(password, policy).map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-good" : "text-ink-3")}>
          {r.ok ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <Circle aria-hidden="true" className="size-3.5" />}
          {r.label}
          <span className="sr-only">{r.ok ? " (done)" : " (needed)"}</span>
        </li>
      ))}
    </ul>
  );
}

function SignUp() {
  const open = useAccountStore((s) => s.openDialog);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, note, run, setError } = useAction();
  const [lock, refreshLock] = useLock();
  const rulesId = useId();
  const policy = usePasswordRules();
  const missing = passwordProblems(password, policy);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => signUpWithEmail(email, password));
    refreshLock();
    if (r.ok) open("verify");
  };

  return (
    <div>
      <GoogleButton
        onDone={(r) => {
          if (!r.ok) setError(r.message);
          refreshLock();
        }}
      />
      <Divider />
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label="Email">
          <input type="email" required autoComplete="email" inputMode="email" maxLength={254} data-testid="account-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password" hintId={rulesId} hint={<RulesList password={password} policy={policy} />}>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" describedBy={rulesId} testId="account-password" />
        </Field>
        <Feedback error={lock > 0 ? `Too many attempts. Try again in ${lock} seconds.` : error} note={note} />
        <Button type="submit" variant="primary" disabled={busy || lock > 0 || missing.length > 0} data-testid="account-submit">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-3 text-sm text-ink-2">
        Already have an account?{" "}
        <button type="button" className="font-bold text-link underline underline-offset-2" onClick={() => open("sign-in")}>
          Sign in
        </button>
      </p>
      <Privacy />
    </div>
  );
}

function Reset() {
  const open = useAccountStore((s) => s.openDialog);
  const [email, setEmail] = useState("");
  const { busy, error, note, run } = useAction();
  return (
    <div>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          await run(() => sendPasswordReset(email));
        }}
      >
        <p className="text-sm text-ink-2">Enter your account&apos;s email and we&apos;ll send a link to choose a new password.</p>
        <Field label="Email">
          <input type="email" required autoComplete="email" inputMode="email" maxLength={254} data-testid="account-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Feedback error={error} note={note} />
        <Button type="submit" variant="primary" disabled={busy} data-testid="account-submit">
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <button type="button" className="mt-3 text-sm font-bold text-link underline underline-offset-2" onClick={() => open("sign-in")}>
        Back to sign in
      </button>
    </div>
  );
}

function Verify() {
  const user = useAccountStore((s) => s.user);
  const { busy, error, note, run } = useAction();
  // Once verified, the dialog closes on its own (AccountDialog) and Cache says hello.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2">
        We sent a link to <strong className="text-ink">{user?.email ?? "your email"}</strong>. Open it to confirm the address; your progress starts
        saving to your account as soon as it is verified. Until then it stays in this browser.
      </p>
      <Feedback error={error} note={note} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => run(() => checkVerified())} data-testid="account-verified">
          I&apos;ve verified
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => run(() => resendVerification())}>
          Resend email
        </Button>
        <Button variant="ghost" onClick={() => void signOutAccount()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

/** A small pill for one way this account can sign in. */
function MethodChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">
      {icon}
      {label}
    </span>
  );
}

/** One row in the account's list of settings: icon, label, a short hint and a chevron. */
function SettingRow({ icon: Icon, label, hint, onClick, testId }: { icon: LucideIcon; label: string; hint: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-link">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.92rem] font-bold text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Account() {
  const user = useAccountStore((s) => s.user);
  const close = useAccountStore((s) => s.closeDialog);
  const open = useAccountStore((s) => s.openDialog);
  const profileName = usePreferencesStore((s) => s.profile.name);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  if (!user) return null;
  const name = profileName || user.name;
  const initial = (name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg font-bold text-link">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[1.05rem] font-bold leading-tight text-ink">{name || user.email}</p>
          {name ? <p className="truncate text-sm text-ink-2">{user.email}</p> : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="account-methods" aria-label="Ways to sign in">
            {user.hasGoogle ? <MethodChip icon={<GoogleLogo small />} label="Google" /> : null}
            {user.hasPassword ? <MethodChip icon={<KeyRound aria-hidden="true" className="size-3" />} label="Email and password" /> : null}
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
        <SyncStatusLine />
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        <SettingRow icon={UserRound} label="Edit profile" hint="Your name, what Cache calls you, your goal" onClick={() => open("profile")} testId="account-edit-profile" />
        <SettingRow
          icon={KeyRound}
          label={user.hasPassword ? "Change password" : "Set a password"}
          hint={user.hasPassword ? "Update the password for this email" : "Also sign in with this email, not only Google"}
          onClick={() => open("password")}
          testId="account-password-view"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button
          size="sm"
          variant="secondary"
          data-testid="account-sign-out"
          onClick={async () => {
            await signOutAccount();
            close();
          }}
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          Sign out
        </Button>
        {!confirming ? (
          <Button size="sm" variant="danger-soft" onClick={() => setConfirming(true)} data-testid="account-delete-start">
            <Trash2 aria-hidden="true" className="size-3.5" />
            Delete account
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-bad/25 bg-bad-soft p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => deleteAccount(password));
            if (r.ok) close();
          }}
        >
          <p className="font-bold text-ink">Delete your account?</p>
          <p className="-mt-2 text-sm text-ink-2">
            This permanently deletes your account, its saved progress and notes, and clears them from this browser. It can&apos;t be undone.
          </p>
          {user.hasPassword ? (
            <Field label="Confirm with your password" hint={user.hasGoogle ? "Or leave it empty to confirm with Google." : undefined}>
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                testId="account-delete-password"
                required={!user.hasGoogle}
              />
            </Field>
          ) : (
            <p className="text-sm text-ink-2">You&apos;ll be asked to confirm with Google.</p>
          )}
          <Feedback error={error} note={null} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" variant="danger" disabled={busy} data-testid="account-delete-confirm">
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/** Set a password (Google-only accounts) or change it (accounts that have one). */
function PasswordView() {
  const user = useAccountStore((s) => s.user);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { busy, error, note, run } = useAction();
  const [lock, refreshLock] = useLock();
  const policy = usePasswordRules();
  const rulesId = useId();
  const missing = passwordProblems(next, policy);
  if (!user) return null;
  const adding = !user.hasPassword;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() => (adding ? addPassword(next) : changePassword(current, next)));
        refreshLock();
        if (r.ok) {
          setCurrent("");
          setNext("");
        }
      }}
    >
      <div className="flex gap-3 rounded-xl bg-surface-2 p-3.5 text-sm text-ink-2">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
        {adding ? (
          <p>
            Add a password to sign in with <strong className="text-ink">{user.email}</strong> as well as Google, so you keep your progress even if
            Google sign-in stops working for you.{user.hasGoogle ? " Google may ask you to confirm it's you." : null}
          </p>
        ) : (
          <p>
            You sign in with <strong className="text-ink">{user.email}</strong> and this password{user.hasGoogle ? ", or with Google" : ""}.
          </p>
        )}
      </div>
      {adding ? null : (
        <>
          <Field label="Current password">
            <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" testId="account-current-password" />
          </Field>
        </>
      )}
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" autoComplete="username" value={user.email ?? ""} readOnly hidden />
      <Field label={adding ? "Password" : "New password"} hintId={rulesId} hint={<RulesList password={next} policy={policy} />}>
        <PasswordInput value={next} onChange={setNext} autoComplete="new-password" describedBy={rulesId} testId="account-new-password" />
      </Field>
      <Feedback error={lock > 0 ? `Too many attempts. Try again in ${lock} seconds.` : error} note={note} />
      <Button type="submit" variant="primary" disabled={busy || lock > 0 || missing.length > 0 || (!adding && !current)} data-testid="account-password-submit">
        {busy ? "Saving…" : adding ? "Set password" : "Change password"}
      </Button>
      {!adding ? (
        <p className="-mt-1 text-center text-xs text-ink-3">
          Forgot it? Sign out and use &ldquo;Forgot password?&rdquo; on the sign-in screen to get a reset link by email.
        </p>
      ) : null}
    </form>
  );
}
