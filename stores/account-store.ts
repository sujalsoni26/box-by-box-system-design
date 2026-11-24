import { create } from "zustand";
import type { SyncInfo } from "@/lib/cloud/sync-engine";

/*
 * Account and sync status for the UI. Runtime only (not persisted): the session itself is kept by Firebase,
 * the progress by the existing stores, and the sync bookkeeping in `sdn-account-v1` (lib/cloud/account-meta.ts).
 */

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  provider: "google" | "password" | "other";
  /** Google accounts are verified; email accounts after clicking the link. Only verified accounts sync. */
  verified: boolean;
}

/**
 * disabled: accounts not configured on this site. loading: restoring a session.
 * signed-out / unverified / signed-in: what the learner sees.
 */
export type AccountPhase = "disabled" | "loading" | "signed-out" | "unverified" | "signed-in";

export type AccountView = "sign-in" | "sign-up" | "reset" | "verify" | "account";

interface AccountState {
  phase: AccountPhase;
  user: AccountUser | null;
  sync: SyncInfo;
  /** Open dialog view, or null when closed. */
  view: AccountView | null;
  /** When this browser's copy of a signed-out account is cleared, ms (null when nothing is scheduled). */
  clearsAt: number | null;
  openDialog: (view?: AccountView) => void;
  closeDialog: () => void;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  phase: "disabled",
  user: null,
  sync: { status: "idle", at: null, error: null },
  view: null,
  clearsAt: null,
  openDialog: (view) => {
    const { phase } = get();
    const fallback: AccountView = phase === "signed-in" ? "account" : phase === "unverified" ? "verify" : "sign-in";
    set({ view: view ?? fallback });
  },
  closeDialog: () => set({ view: null }),
}));
