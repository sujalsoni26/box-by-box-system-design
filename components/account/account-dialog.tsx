"use client";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
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
import { cn } from "@/lib/utils";
import { useAccountStore, type AccountView } from "@/stores/account-store";
import { SyncStatusLine } from "./sync-status";

const TITLES: Record<AccountView, string> = {
  "sign-in": "Sign in to save your progress",
  "sign-up": "Create an account",
  reset: "Reset your password",
  verify: "Verify your email",
  account: "Your account",
};

/**
 * Sign-in, sign-up, password reset, email verification and the account view, in one native modal dialog
 * (focus is trapped, Escape closes, focus returns to the opener). Opened through the account store.
 */
export function AccountDialog() {
  const view = useAccountStore((s) => s.view);
  const close = useAccountStore((s) => s.closeDialog);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
            <h2 id={titleId} className="font-display text-xl font-bold leading-tight">
              {TITLES[view]}
            </h2>
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

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; describedBy?: string; testId: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex">
      <input
        type={show ? "text" : "password"}
        required
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
      {busy ? "Opening Google…" : "Continue with Google"}
    </Button>
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

function SignUp() {
  const open = useAccountStore((s) => s.openDialog);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, note, run, setError } = useAction();
  const [lock, refreshLock] = useLock();
  const rulesId = useId();
  const policy = usePasswordRules();
  const missing = passwordProblems(password, policy);
  const rules = passwordChecks(password, policy);

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
        <Field
          label="Password"
          hintId={rulesId}
          hint={
            <ul className="mt-0.5 space-y-0.5">
              {rules.map((r) => (
                <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-good" : "text-ink-3")}>
                  {r.ok ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <Circle aria-hidden="true" className="size-3.5" />}
                  {r.label}
                  <span className="sr-only">{r.ok ? " (done)" : " (needed)"}</span>
                </li>
              ))}
            </ul>
          }
        >
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
  const phase = useAccountStore((s) => s.phase);
  const open = useAccountStore((s) => s.openDialog);
  const { busy, error, note, run } = useAction();
  useEffect(() => {
    if (phase === "signed-in") open("account");
  }, [phase, open]);
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

function Account() {
  const user = useAccountStore((s) => s.user);
  const close = useAccountStore((s) => s.closeDialog);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-bold text-ink">{user.email}</p>
        <p className="text-sm text-ink-3">{user.provider === "google" ? "Signed in with Google" : "Signed in with email"}</p>
      </div>
      <SyncStatusLine />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          data-testid="account-sign-out"
          onClick={async () => {
            await signOutAccount();
            close();
          }}
        >
          Sign out
        </Button>
        {!confirming ? (
          <Button variant="ghost" className="text-bad" onClick={() => setConfirming(true)} data-testid="account-delete-start">
            Delete account…
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-3">When you sign out, your progress stays in this browser for 5 days, then it&apos;s cleared here. Your account keeps it.</p>
      {confirming ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-bad/40 bg-bad-soft p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => deleteAccount(password));
            if (r.ok) close();
          }}
        >
          <p className="text-sm text-ink">
            This permanently deletes your account, its saved progress and notes, and clears them from this browser. It can&apos;t be undone.
          </p>
          {user.provider === "password" ? (
            <Field label="Confirm with your password">
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" testId="account-delete-password" />
            </Field>
          ) : (
            <p className="text-sm text-ink-2">You&apos;ll be asked to confirm with Google.</p>
          )}
          <Feedback error={error} note={null} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={busy} data-testid="account-delete-confirm">
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
