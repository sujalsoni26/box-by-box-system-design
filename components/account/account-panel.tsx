"use client";
import { Button } from "@/components/ui/button";
import { useAccountStore } from "@/stores/account-store";
import { SyncStatusLine } from "./sync-status";

function daysLeft(at: number): number {
  return Math.max(1, Math.ceil((at - Date.now()) / 86_400_000));
}

/** Progress page: what is saved where, and the way in to the account. Hidden when accounts are not configured. */
export function AccountPanel() {
  const phase = useAccountStore((s) => s.phase);
  const user = useAccountStore((s) => s.user);
  const clearsAt = useAccountStore((s) => s.clearsAt);
  const open = useAccountStore((s) => s.openDialog);
  if (phase === "disabled") return null;

  return (
    <section id="account" aria-labelledby="account-h" data-testid="account-panel" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5">
      <h2 id="account-h" className="font-display text-2xl font-bold text-ink">
        Your account
      </h2>
      {phase === "signed-in" ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-ink-2">
            Signed in as <strong className="text-ink">{user?.email}</strong>. Your progress, notes and settings are saved to your account and follow you to
            any device you sign in on.
          </p>
          <SyncStatusLine />
          <div>
            <Button variant="secondary" onClick={() => open("account")}>
              Manage account
            </Button>
          </div>
        </div>
      ) : phase === "unverified" ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-ink-2">
            Verify <strong className="text-ink">{user?.email}</strong> to start saving your progress to your account. Until then it stays in this browser.
          </p>
          <div>
            <Button variant="primary" onClick={() => open("verify")}>
              Verify email
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-ink-2">
            Your progress is saved in this browser. Sign in (optional) to keep it in your account, so clearing the browser or switching devices doesn&apos;t
            lose it. What you&apos;ve done so far is added to your account when you sign in.
          </p>
          {clearsAt ? (
            <p className="text-sm text-ink-3" data-testid="account-clears">
              You signed out. The progress in this browser will be cleared in {daysLeft(clearsAt)} day{daysLeft(clearsAt) === 1 ? "" : "s"}; your account
              keeps it.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={phase === "loading"} onClick={() => open("sign-in")} data-testid="account-panel-sign-in">
              Sign in
            </Button>
            <Button variant="secondary" disabled={phase === "loading"} onClick={() => open("sign-up")}>
              Create an account
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
