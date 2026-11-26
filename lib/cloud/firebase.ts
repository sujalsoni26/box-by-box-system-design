/*
 * Firebase, loaded on demand (only when someone opens the sign-in dialog or was signed in before), so guests
 * never download it. One app, one Auth, one Firestore per page.
 *
 * Data layout: users/{uid}/stores/{progress|preferences|notes|focus} = { json, rev, updatedAt }.
 * The rules (firebase/firestore.rules) let only the verified owner read and write, accept revision n+1 over n,
 * cap the size of each record and refuse writes less than two seconds apart.
 *
 * Firestore Lite: each read and write is one plain HTTPS request. The full SDK keeps a streaming connection
 * (WebChannel) open for every read, which fills the browser console with reconnect warnings and failed
 * "Listen/channel" requests whenever a tab sleeps or a network drops it; this app never needs live updates.
 */
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore/lite";
import { appCheckDebug, appCheckSiteKey, authDomainFor, cloudConfig } from "./config";
import { SYNC_KEYS, type SyncKey } from "./merge";
import { BackendError, type CloudBackend, type RemoteDoc } from "./sync-engine";

export interface FirebaseKit {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  a: typeof import("firebase/auth");
  f: typeof import("firebase/firestore/lite");
}

let kit: Promise<FirebaseKit> | null = null;

export function loadFirebase(): Promise<FirebaseKit> {
  const config = cloudConfig;
  if (!config) return Promise.reject(new Error("Accounts are not configured on this site."));
  if (!kit) {
    kit = (async () => {
      const [appMod, a, f] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore/lite")]);
      const app = appMod.getApps()[0] ?? appMod.initializeApp({ ...config, authDomain: authDomainFor(window.location, config.authDomain) });
      if (appCheckSiteKey) {
        // App Check: requests carry a token proving they come from this site (enforced in the console).
        const ac = await import("firebase/app-check");
        if (appCheckDebug) (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        ac.initializeAppCheck(app, { provider: new ac.ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
      }
      const auth = a.getAuth(app);
      auth.useDeviceLanguage();
      const db = f.getFirestore(app);
      // A refused save is part of normal syncing (another device saved first, or two saves within 2 s); the engine
      // merges and retries, so the SDK's per-request warnings would only be noise in the console.
      f.setLogLevel("error");
      return { app, auth, db, a, f };
    })();
    kit.catch(() => {
      kit = null; // a failed download can be retried
    });
  }
  return kit;
}

const WRITE_TIMEOUT_MS = 20_000;

function backendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const code = (e as { code?: string } | null)?.code ?? "";
  if (code === "permission-denied") return new BackendError("denied");
  if (code === "unavailable" || code === "deadline-exceeded" || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return new BackendError("offline");
  }
  return new BackendError("other", code || String(e));
}

function parseDoc(data: unknown): RemoteDoc | null {
  const d = data as { json?: unknown; rev?: unknown } | undefined;
  return d && typeof d.json === "string" && typeof d.rev === "number" ? { json: d.json, rev: d.rev } : null;
}

/** The sync engine's view of Firestore. */
export function firestoreBackend({ db, f }: FirebaseKit): CloudBackend {
  const ref = (uid: string, key: SyncKey) => f.doc(db, "users", uid, "stores", key);
  return {
    async readAll(uid) {
      try {
        const snap = await f.getDocs(f.collection(db, "users", uid, "stores"));
        const out: Partial<Record<SyncKey, RemoteDoc>> = {};
        snap.forEach((d) => {
          const key = d.id as SyncKey;
          const doc = SYNC_KEYS.includes(key) ? parseDoc(d.data()) : null;
          if (doc) out[key] = doc;
        });
        return out;
      } catch (e) {
        throw backendError(e);
      }
    },
    async read(uid, key) {
      try {
        const d = await f.getDoc(ref(uid, key));
        return d.exists() ? parseDoc(d.data()) : null;
      } catch (e) {
        throw backendError(e);
      }
    },
    async write(uid, key, json, rev) {
      // A request on a stalled connection can hang for a long time; give up waiting after a while so the engine
      // can report "offline" and retry (a write that lands later anyway is reconciled by revision).
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          f.setDoc(ref(uid, key), { json, rev, updatedAt: f.serverTimestamp() }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new BackendError("offline")), WRITE_TIMEOUT_MS);
          }),
        ]);
      } catch (e) {
        throw backendError(e);
      } finally {
        clearTimeout(timer);
      }
    },
    async removeAll(uid) {
      try {
        await Promise.all(SYNC_KEYS.map((key) => f.deleteDoc(ref(uid, key))));
      } catch (e) {
        throw backendError(e);
      }
    },
  };
}
