"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CloudCheck, CloudOff, RefreshCw } from "lucide-react";
import { useAccountStore } from "@/stores/account-store";

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

const ERRORS: Record<string, string> = {
  "too-large": "Your notes are too large to save to your account. Shorten some notes to resume saving.",
  denied: "Your account refused the save. Sign out and in again; if it keeps happening, the site's setup may need checking.",
  failed: "Couldn't save to your account. It will try again; your progress is safe in this browser.",
};

/** "Saved to your account · 2 minutes ago", "Saving…", "Offline: will save when you're back online", or a problem. */
export function SyncStatusLine() {
  const sync = useAccountStore((s) => s.sync);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const base = "flex items-start gap-2 text-sm";
  if (sync.status === "error") {
    return (
      <p role="status" data-testid="sync-status" data-status="error" className={`${base} text-bad`}>
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {ERRORS[sync.error ?? "failed"] ?? ERRORS.failed}
      </p>
    );
  }
  if (sync.status === "offline") {
    return (
      <p role="status" data-testid="sync-status" data-status="offline" className={`${base} text-ink-2`}>
        <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Offline: your progress is safe here and will save to your account when you&apos;re back online.
      </p>
    );
  }
  if (sync.status === "syncing" || sync.status === "idle") {
    return (
      <p role="status" data-testid="sync-status" data-status="syncing" className={`${base} text-ink-2`}>
        <RefreshCw aria-hidden="true" className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin" />
        Saving to your account…
      </p>
    );
  }
  return (
    <p role="status" data-testid="sync-status" data-status="synced" className={`${base} text-good`}>
      <CloudCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      Saved to your account{sync.at ? ` · ${ago(sync.at, now)}` : ""}
    </p>
  );
}
