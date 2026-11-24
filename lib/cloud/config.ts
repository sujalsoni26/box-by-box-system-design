/*
 * Firebase web config, from build-time environment variables (Netlify: Site configuration → Environment
 * variables; locally: .env.local). These identify the project; they are not secrets. Protection comes from the
 * Firestore security rules, the authorized domains, App Check and the API key's restrictions (docs/accounts.md).
 *
 * Without them the site works exactly as before: accounts are simply not offered.
 * Each variable is read by its full literal name so Next.js can inline it into the client bundle.
 */

export interface CloudConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";

export const cloudConfig: CloudConfig | null = apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;

/** True when accounts and sync are offered. */
export const cloudEnabled = cloudConfig !== null;

/** reCAPTCHA v3 site key for Firebase App Check (optional but recommended). */
export const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;

/** Local development only: print an App Check debug token to register in the console. */
export const appCheckDebug = process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true";
