# Accounts and cloud sync (optional)

Learners can stay guests (everything in the browser, as before) or sign in with **Google** or **email and
password** so their progress is kept in their account and follows them to any device. Built on Firebase
Authentication and Cloud Firestore, both within the free Spark plan for this site's scale.

If the Firebase environment variables are not set, accounts are simply not offered and the site behaves exactly
as before.

## What is synced

| Store | Synced | Device only |
|---|---|---|
| Progress (`sdn-progress-v1`) | completed lessons, visits, bookmarks, review flags, quiz attempts, known flashcards | – |
| Notes (`sdn-notes-v1`) | every lesson note | – |
| Preferences (`sdn-preferences-v1`) | theme, known glossary terms, Cache's settings, stats, wardrobe, the profile (name, what Cache calls you, goal, target date) | Cache's spot on the screen |
| Focus (`sdn-focus-v1`) | focus length, sessions completed | a running timer |

## Behaviour

- **Guests**: unchanged. Nothing leaves the browser.
- **First sign-in on a browser**: everything done as a guest is merged into the account (union of learned lessons,
  bookmarks, review flags, quiz attempts and flashcards; the newest edit of each note; the higher counters;
  settings from the account). Nothing is lost.
- **Signed in**: each change is saved to the account about 4 seconds later, and right away when the tab is hidden or
  closed. Opening the site loads the account's copy, so changes made on other devices (including removals) arrive.
  Offline changes are kept and saved when the connection returns.
- **Two devices at once**: every save carries a revision number, and the database accepts only the next one. If
  another device saved first, the save is refused, the newer copy is merged in and the save is retried.
- **Email accounts** must verify their email (a link is sent on sign-up) before anything is saved to the account.
  Until then progress stays in the browser.
- **Signing in closes the dialog** and Cache says hello. An email account that still has to verify its address
  moves on to the "Verify your email" step instead.
- **Profile** (Progress page → Your profile, or the account dialog → Edit profile): a name, what Cache calls the
  learner ("hooman" until they choose), why they are here and an optional interview or exam date with a suggested
  daily pace. Nothing sensitive is asked. Guests keep it in the browser; accounts sync it with the settings (on the
  first sign-in, the account's answers win field by field and a guest's own answers fill the gaps).
- **Set a password** (account dialog, Google accounts): links a password to the same account, so the learner can
  still sign in with that email and password, and keep their progress, if Google sign-in stops working for them.
  Firebase may ask them to confirm with Google first. Accounts that have a password can **change** it there
  (confirming the current one). A wrong current password counts towards the sign-in lock-out.
- **Sign-out**: the progress stays in that browser for **5 days** (in case it was a mistake), then it is cleared
  from the browser automatically the next time the site is opened. The account keeps everything.
- **Another person signing in on the same browser** never receives the previous account's progress: their own
  account's copy replaces it.
- **Delete account** (Progress page → Your account → Manage account): confirms identity again (the password, or the
  Google pop-up), then deletes the account's saved data, the account itself and the browser's copy.

## Security

Defence in depth; the server side is what actually enforces it.

| Layer | What it does |
|---|---|
| Firebase Authentication | Server-side throttling of repeated failed sign-ins (`auth/too-many-requests`), the project's password policy, email enumeration protection (no way to probe which emails have accounts), authorized domains only. |
| Firestore rules (`firebase/firestore.rules`) | Only the signed-in owner with a verified email can read or write `users/{uid}/stores/*`; only the four known stores; exactly three fields (`json`, `rev`, `updatedAt` = server time); size caps per store; each save must be the next revision; at most one save per store every 2 seconds (rate limit); everything else in the database is closed. |
| App Check (reCAPTCHA v3) | Once enforced, the database only answers requests that come from this site, not from scripts using the public config. |
| API key restrictions | The browser key only works from the site's domains and only for the Firebase APIs it needs. |
| Client (`lib/cloud/guards.ts`) | After 3 failed attempts this browser waits 15 s, 30 s, 60 s … up to 15 minutes; verification and reset emails at most once a minute; messages never reveal whether an email has an account; password strength checked before sending. |
| Headers (`next.config.ts`) | A Content Security Policy (scripts, requests and frames only from this site and the Firebase/Google endpoints sign-in, sync and App Check use; no plugins, no framing, `base-uri` and `form-action` locked to this site), `X-Frame-Options: DENY` (no clickjacking of the sign-in form), `nosniff`, a strict referrer policy, HSTS and a restrictive permissions policy. Firebase's pages under `/__/` keep Firebase's own headers. If a new Google or Firebase feature is added (for example Analytics), add its hosts to the policy, or the browser blocks it. |

The Firebase web config is public by design (it identifies the project); it is not a secret. Never put a service
account key or admin credentials in this repository or in Netlify.

## Setup (Firebase console)

Project: the one you created (Firestore location in India). Do these once.

1. **Authentication → Get started → Sign-in method**
   - Enable **Email/Password** (leave "Email link (passwordless)" off).
   - Enable **Google** (choose a project support email).
2. **Authentication → Settings**
   - **Authorized domains**: add `box-by-box.netlify.app` (`localhost` is there already). Remove anything you
     don't use.
   - **Password policy**: enable it, require at least 8 characters with uppercase, lowercase and a number, and set
     enforcement to *Require enforcement* (weak passwords are then refused by the server too). Requiring a symbol
     or a longer minimum is fine: the sign-up form reads the policy and lists the same rules. The app never accepts
     less than 8 characters with upper and lower case letters and a number, whatever the policy says.
   - **Email enumeration protection**: make sure it is enabled (it is by default on new projects).
3. **Firestore Database → Create database**: production mode, location in India (for example `asia-south1`,
   Mumbai). Then open **Rules**, replace everything with the contents of `firebase/firestore.rules`, and
   **Publish**.
4. **Project settings → General → Your apps → Add app → Web (`</>`)**: give it a name, don't enable Hosting,
   register. Copy these four values from the `firebaseConfig` it shows: `apiKey`, `authDomain`, `projectId`,
   `appId`.
5. **App Check (recommended)**
   - Create a **reCAPTCHA v3** key at <https://www.google.com/recaptcha/admin> with the domains
     `box-by-box.netlify.app` and `localhost`.
   - Firebase console → **App Check → Apps** → your web app → **reCAPTCHA** → paste the **secret** key, save.
   - Put the **site** key in `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (below).
   - Watch **App Check → APIs → Cloud Firestore** for a few days after deploying; when the requests show as
     verified, click **Enforce**.
6. **API key restrictions (recommended)**: Google Cloud console → APIs & Services → Credentials → the "Browser key
   (auto created by Firebase)":
   - *Application restrictions* → Websites: `https://box-by-box.netlify.app/*`, `http://localhost:3000/*` and
     `https://<project-id>.firebaseapp.com/*` (the Google sign-in pop-up runs there).
   - *API restrictions*: Identity Toolkit API, Token Service API, Cloud Firestore API, Firebase Installations API,
     Firebase App Check API.
   - Test sign-in afterwards; a missing entry shows up as "Sign-in isn't available on this site right now."
7. Optional: **Authentication → Templates** to set the sender name of the verification and reset emails.
8. **Sign-in pages on this site's domain** (see the next section):
   - Google Cloud console → APIs & Services → **Credentials** → OAuth 2.0 Client IDs → **Web client (auto created by
     Google Service)** → *Authorized redirect URIs* → add `https://box-by-box.netlify.app/__/auth/handler` → Save.
   - Once the site with accounts is live: **Authentication → Templates** → edit any template → **Customize action
     URL** → `https://box-by-box.netlify.app/__/auth/action` → Save (it applies to every email type).

## Sign-in pages on this site's domain

Google sign-in runs in a pop-up, and the verification and reset emails link to a page. Firebase hosts those pages on
`<project-id>.firebaseapp.com`, which some office and school networks block (the pop-up then stays blank). So the
deployed site serves them itself: `next.config.ts` forwards `/__/auth/*` and `/__/firebase/*` to Firebase, and
`lib/cloud/config.ts` uses the site's own domain as the auth domain on any host except localhost. Google's screen
then also says "Continue to box-by-box.netlify.app". This is Firebase's documented "proxy auth requests" setup.

- **localhost** keeps using `<project-id>.firebaseapp.com`, so local development needs nothing extra (on a network
  that blocks that domain, test Google sign-in on a deploy preview instead).
- Every deployed domain needs its `/__/auth/handler` URI in the OAuth client (step 8) and its name in Authorized
  domains (step 2), or Google sign-in fails there.
- To turn this off (back to the pop-up on firebaseapp.com), set `NEXT_PUBLIC_FIREBASE_AUTH_PROXY=off` and redeploy.

## Setup (Netlify and local)

**Netlify** → Site configuration → Environment variables (scope: Builds), then **Trigger deploy** (the values are
baked in at build time):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` (`<project-id>.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key (optional, for App Check) |

**Local**: create `system-design-next/.env.local` (git ignores it) with the same variables. If App Check is set
up, also add `NEXT_PUBLIC_APPCHECK_DEBUG=true`, open the site on localhost once, copy the debug token printed in
the browser console, and add it under App Check → Apps → Manage debug tokens.

Deploy previews (`deploy-preview-N--box-by-box.netlify.app`): sign-in works there only after you add that domain
to Authorized domains and `https://deploy-preview-N--box-by-box.netlify.app/__/auth/handler` to the OAuth client's
redirect URIs. Remove both when you're done testing.

## Free plan

Spark (no billing) covers this comfortably: one learner uses a few document reads per visit and one write per
store a few seconds after changes (about 1 read + 1 write per save), against daily limits of tens of thousands.
Email/password and Google sign-in are free; phone sign-in is not used.

## Code

| File | Role |
|---|---|
| `lib/cloud/config.ts` | Reads the environment variables (accounts are off without them); picks the auth domain. |
| `lib/cloud/firebase.ts` | Loads Firebase on demand (guests never download it), App Check, the Firestore adapter (Firestore Lite: one HTTPS request per read or write, no streaming connection, so no reconnect noise in the console). |
| `lib/cloud/controller.ts` | Session restore, sign-in/up, reset, verification, set/change password, sign-out, delete; runs the sync engine. |
| `lib/cloud/sync-engine.ts` | Merge-on-sign-in, resume, debounced uploads, compare-and-set retries, offline retries. |
| `lib/cloud/merge.ts` | How each store merges, what is device-only. |
| `lib/cloud/account-meta.ts`, `lib/cloud/expiry.ts` | Ownership of the browser's data and the 5-day expiry after sign-out. |
| `lib/cloud/guards.ts` | Client throttling, email cooldowns, validation, safe error messages. |
| `components/account/*` | Header button, sign-in dialog, profile form, Progress page panel, sync status. |
| `firebase/firestore.rules` | The database rules to publish. |

Tests: `scripts/tests/cloud.test.mjs` (merge rules, expiry, guards, and two simulated devices syncing through a
fake cloud that applies the same rules) and `scripts/tests/profile.test.mjs` (profile cleaning and syncing, Cache's
name for the learner, the suggested pace, password messages).
