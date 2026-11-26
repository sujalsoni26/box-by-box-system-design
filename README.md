# Box by Box

An interactive system design course that grows one Instagram-like app from a single server to millions of users.
Every lesson follows one pattern: **problem → what breaks → building block → trade-offs**.

- **143 lessons in 16 modules:** a six-module core path (foundations, scaling and traffic, communication, data, performance and reliability, design practice), seven advanced tracks (distributed systems, database internals, streaming, observability, security, infrastructure, architecture patterns), 15 high-level design case studies, and low-level design foundations with 14 LLD case studies.
- **25 interactive simulations:** load balancers, caches, CAP partitions, circuit breakers, rate limiters, an estimation calculator and more. Animated ones have their own 0.5x / 1x / 1.5x speed control. There are also Mermaid and SVG diagrams.
- **Practice:** 43 optional knowledge checks (scenario, trade-off and debugging questions), five flashcard decks, an estimation calculator, and a live architecture map that lights up as you learn.
- **Case studies:** 29 interview problems (15 HLD, 14 LLD) worked step by step. Answer each step yourself, take a hint if stuck, then reveal the insight and compare with the full walkthrough.
- **Mark for review:** flag any lesson or case study to come back to. It is independent of "learned" and listed on the dashboard and the Progress page.
- **Short forms:** a glossary of 181 terms. Only the first mention per lesson is hinted.
- **Cache, the study cat:** throw her and she stays where she lands; feed, pet and play with her, send her for a lamp nap, and unlock accessories and costumes through progress. She explains lessons simply, asks quick revision questions, runs an adjustable focus timer (and plays during the breaks), shares the odd fact from the lesson you are reading, and asks (once) whether to mark a finished lesson as learned.
- **Study notes:** a plain-text note per lesson, saved in the browser. Every lesson has an "On this page" outline (sections, simulations, "Go deeper" parts, recall and checks). On wide screens Notes and "On this page" share the right column as collapsible panels (one open at a time); smaller screens get a folded outline at the top of the lesson and a notes sheet.
- **Readable diagrams:** a diagram that is squeezed or overflows its column opens in an in-page lightbox with zoom and pan.
- **Persistent progress:** saved in the browser, with light and dark themes, keyboard support and reduced-motion support.
- **Optional accounts:** sign in with Google or email to keep progress, notes and settings in your account and use them on any device (Firebase, free plan). Guests keep everything in the browser as before. Setup: [docs/accounts.md](docs/accounts.md).

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, MDX, Zustand, Motion, Mermaid and Shiki. There's no backend of its own; optional accounts use Firebase Authentication and Cloud Firestore.

## Run

Requires Node.js 20.9 or newer. Versions of everything used are in [TECH_STACK.md](TECH_STACK.md).

```bash
npm install
npm run dev        # development: http://localhost:3000
npm run build      # production build
npm run start      # serve the build: http://localhost:3000
npm run check      # type check + lint + lesson and practice-data validation + unit tests
npm test           # unit tests only (Node's built-in runner, no extra dependencies)
```

On Windows, if PowerShell blocks `npm` scripts, use `npm.cmd` instead, e.g. `npm.cmd run dev`.

Accounts are off unless the Firebase variables are set (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, optionally `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) in `.env.local` or the host's build environment. See [docs/accounts.md](docs/accounts.md).

## Project layout

```
app/              routes: dashboard, /learn, /learn/[module]/[slug] (old /learn/<slug> URLs redirect), /case-studies, /case-studies/[slug], /practice, /progress, /glossary
content/lessons/  lesson bodies (MDX)
data/             curriculum, quizzes, case studies, flashcards, glossary, lesson guides
components/       UI, lesson layout, diagrams, quiz, glossary, companion
stores/           Zustand stores (progress, preferences, companion)
lib/              helpers, hooks, storage adapter, MDX plugin
docs/             architecture and companion notes
```

More detail is in [docs/architecture.md](docs/architecture.md) and [docs/companion.md](docs/companion.md).

Fonts (Bricolage Grotesque, Atkinson Hyperlegible Next, JetBrains Mono) are self-hosted under the SIL Open Font License 1.1.
