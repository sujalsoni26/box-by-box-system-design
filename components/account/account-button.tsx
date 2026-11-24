"use client";
import { LogIn } from "lucide-react";
import { warmUp } from "@/lib/cloud/controller";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/account-store";
import { AccountDialog } from "./account-dialog";

/**
 * Header control: "Sign in" for guests, the account's initial when signed in (with a small dot when saving is
 * offline or failing). Renders nothing when accounts are not configured on this site.
 */
export function AccountButton() {
  const phase = useAccountStore((s) => s.phase);
  const user = useAccountStore((s) => s.user);
  const sync = useAccountStore((s) => s.sync.status);
  const open = useAccountStore((s) => s.openDialog);
  if (phase === "disabled") return null;

  const signedIn = phase === "signed-in" || phase === "unverified";
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const dot = phase === "unverified" ? "bg-amber" : sync === "error" ? "bg-bad" : sync === "offline" ? "bg-ink-3" : null;
  const label = signedIn
    ? `Account: ${user?.email ?? ""}${phase === "unverified" ? " (email not verified yet)" : sync === "error" ? " (saving failed)" : sync === "offline" ? " (offline)" : ""}`
    : "Sign in to save your progress";

  return (
    <>
      <button
        type="button"
        data-testid="account-button"
        data-phase={phase}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        disabled={phase === "loading"}
        onPointerEnter={warmUp}
        onFocus={warmUp}
        onClick={() => open()}
        className={cn(
          "relative grid h-10 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60",
          signedIn || phase === "loading" ? "w-10" : "px-2.5 sm:px-3",
        )}
      >
        {signedIn ? (
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-accent font-display text-sm font-bold text-accent-ink">
            {initial}
          </span>
        ) : phase === "loading" ? (
          <span aria-hidden="true" className="size-7 rounded-full bg-surface-3 motion-safe:animate-pulse" />
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <LogIn aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Sign in</span>
          </span>
        )}
        {dot ? <span aria-hidden="true" className={cn("absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-surface", dot)} /> : null}
      </button>
      <AccountDialog />
    </>
  );
}
