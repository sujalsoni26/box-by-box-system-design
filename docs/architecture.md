# Architecture

## Content

- **Curriculum** (`data/curriculum/`: `modules.ts` and one `lessons/<module>.ts` per module): 16 modules, 143 lessons, in learning order. Each lesson has metadata the layout renders:
  title, level, minutes, `problem`, `summary` (the building block), `catTip`, `recall`, and `archNodes` (the boxes of the final
  architecture it lights up).
- **Teaching guidance** (`data/lesson-guides/<module>.ts`): `breaks`, `tradeoffs`, `explainSimply`, `hint` per lesson. Kept separate so it
  can be edited without touching lesson metadata. `lib/curriculum.ts` merges both into a `Lesson`.
- **Lesson bodies** (`content/lessons/<slug>.mdx`): prose plus a small component vocabulary (see `mdx-components.tsx`):
  `Callout`, `Comparison`/`ComparisonItem`, `DeepDive`, `Steps`, `ConceptCard`, `Diagram`, `Mermaid`, `Interactive`.
  The lesson page imports the MDX file by slug and prerenders every lesson route at build time.
- **Quizzes** (`data/quizzes/<module>.ts`) are optional knowledge checks shown after the lesson that completes their topics, and all
  together on `/practice`. A question may only test lessons up to its check's `afterLesson`; answer positions are balanced.
  **Recall decks** (`data/recall/<deck>.ts`) feed the flashcards.
- **Case studies** (`data/case-studies/<slug>.ts`, `types/case-study.ts`) are guided interview exercises, one per HLD/LLD case-study
  lesson and keyed by that lesson's slug. `/case-studies/[slug]` reveals one step at a time (prompt, optional hint, insight);
  the lesson stays the full worked answer, and links to the exercise. `scripts/validate-practice.mjs` checks quizzes and
  case studies (ids, options, answer balance, lesson order, step counts).

### Adding a lesson

1. Add metadata to `data/curriculum/lessons/<module>.ts` and list the slug in that module in `data/curriculum/modules.ts`.
2. Add guidance to `data/lesson-guides/<module>.ts`.
3. Write `content/lessons/<slug>.mdx`.
4. Run `npm run check` (types, lint, `validate:content` and `validate:practice`).

## Short forms (acronyms)

`data/glossary.json` is the single source of truth. At build time, `lib/mdx/remark-acronyms.mjs` wraps the **first** mention
of each term in a lesson with `<Acronym>`. Later mentions stay plain, and headings, links, code and diagrams are skipped.
Authors write plain text. The `Acronym` popover opens on hover or focus and pins on tap or click. It is announced to screen
readers as the button's description. Learners can mark a term as known to stop its hints; the glossary page lists every term.
The popover is shown in the browser's top layer (so table and diagram scrollers cannot clip it) and resets every inherited
text style (wrapping, case, letter-spacing, weight, style), so it reads the same in a table header, a bold cell, a quote, a
callout or a list.

## State and persistence

- `stores/progress-store.ts`: completed lessons, visits (recently studied), current/last lesson, quiz attempts, bookmarks,
  topics marked for review (`review`, slug to timestamp; independent of `completed`), known flashcards.
- `stores/preferences-store.ts`: theme, known glossary terms, companion settings and position.
- `stores/companion-store.ts`: companion runtime state and the focus timer.

All persisted stores go through `lib/storage/adapter.ts` (`persistenceAdapter`). Today that is localStorage with an in-memory
fallback. To move to authenticated server storage, implement the same `getItem/setItem/removeItem` interface (it may be async)
against an API and export it as `persistenceAdapter`. UI code only talks to the stores.

**Study notes** (`stores/notes-store.ts`, key `sdn-notes-v1`) keep one plain-text note per lesson. `notes` maps a lesson slug to
`{ text, updatedAt }`. (Older saves also carry a `panelOpen` flag; it is ignored and dropped on the next save.) The editor in
`components/learning/lesson-notes.tsx` saves about 400 ms after typing stops, and straight away on blur, close, or when the page is
hidden. Saving empty text deletes the entry. Stored data is checked on load, so malformed JSON or entries are dropped instead of
breaking hydration. Notes are kept in this browser only and are not synced.

On wide screens (xl) the right column holds two collapsible panels, "On this page" and Notes, owned by one component
(`components/learning/lesson-side-panels.tsx`): opening one closes the other, and both may be closed (`toggleSidePanel` in
`lib/learning/side-panels.ts`). "On this page" starts open. The choice is kept for the browser session (sessionStorage
`sdn-side-panel`), so moving between lessons does not flip it. Below xl, the Notes chip in the lesson header opens the sheet. At any size, Expand (in the panel or the sheet) or the N key opens a large writing view (`LessonNotesFocus`); Done or Escape closes it and the page is where the reader left it.

"On this page" is built from the rendered lesson (`components/learning/on-this-page.tsx`, rules in `lib/learning/outline.ts`),
so every lesson has one, including those written around steps and simulations rather than `##` sections: the lesson's
sections, its `###` headings, "Try it" simulations (titles in `components/diagrams/interactive-titles.ts`, available
before a simulation loads), "Go deeper" sections (opened when picked), the page's own parts (Problem to building block,
Quick recall, Knowledge check, Mark as learned) and, for lessons that would otherwise have fewer than 7 entries, titled
callouts. Below xl the same outline is a folded "On this page" box at the top of the lesson.

**Optional accounts** (docs/accounts.md): when the Firebase variables are set, a signed-in learner's four stores are
also kept in Firestore (`users/{uid}/stores/*`). The adapter notifies `lib/cloud/controller.ts` of every save; the
sync engine (`lib/cloud/sync-engine.ts`) merges on sign-in, loads the account's copy on later visits, and uploads
changes a few seconds later with compare-and-set revisions. A signed-out account's copy is cleared from the
browser after 5 days (`lib/cloud/expiry.ts`, run before the stores load).

Stores use `skipHydration` and are rehydrated in `AppProviders` on the client. Components that show persisted data check
`useHydrated()` first, so server HTML and the first client render always match (no hydration errors). The theme is applied
before first paint by `ThemeScript`, which reads the same localStorage key.

## Diagrams

- **Mermaid** (`components/diagrams/mermaid.tsx`): sequence, state and flow diagrams written as text in MDX. Rendered on the
  client only when scrolled near, themed from the CSS tokens, and re-rendered when the theme changes.
- **Static SVG** (`components/diagrams/static/*`): hand-drawn diagrams as React components using the `dg-*` classes in
  `app/globals.css`, so they follow the theme.
- **Interactive** (`components/diagrams/interactive/*`): simulations, each code-split through `interactive-registry.tsx` and
  mounted only when scrolled near. Loops pause off-screen and in hidden tabs and respect reduced motion.
  Blocks listed in `ANIMATED_INTERACTIVES` get a local 0.5x / 1x / 1.5x speed control (`components/diagrams/sim-speed.tsx`):
  each block owns its speed (`SimSpeedProvider` in `InteractiveDiagram`), frame loops scale `dt`, timers and tweens use
  `simDuration` / `useSimNow`, and CSS keyframes read `--sim-speed` set on the block. It never affects other blocks or the companion.
- **Lightbox** (`components/diagrams/diagram-frame.tsx`, `diagram-lightbox.tsx`): Mermaid and static diagrams sit in a
  `DiagramFrame` that measures them (ResizeObserver). Only a *constrained* diagram (scaled below 88% of its natural size, or
  overflowing its column; `lib/diagrams/constrained.ts`) gets an Expand button and a zoom-in cursor; one that fits stays plain.
  Expanding opens an in-page modal (never a new tab): `role="dialog"`, `aria-modal`, labelled by the caption, focus on Close,
  focus trapped, Escape / X / backdrop close, focus returned to the opener, page scroll locked and restored. The SVG is shown as
  vector at a readable zoom (fit when that is at least 80%, else 1:1), with zoom buttons and keys (+, -, 0, 1), drag or arrow-key
  pan and pinch / Ctrl+wheel zoom (`lib/diagrams/zoom.ts`). Mermaid copies get their element ids suffixed so markers and
  scoped styles still resolve (`lib/diagrams/svg-ids.ts`).

## Companion events

`lib/companion-events.ts` is a tiny event bus. Lessons, quizzes and diagrams emit events such as `lesson-complete`,
`quiz-answer` and `diagram`. The companion decides whether to react, so the rest of the app never depends on it.

## Motion and accessibility

Motion follows the operating system's `prefers-reduced-motion` only: CSS stops animations under that media query, Motion's
`MotionConfig reducedMotion="user"` does the same for JS animations, and `useMotionLevel()` exposes it to components. There is
no site-wide animation-speed setting (older saves that carried one are ignored); Try it blocks have their own local speed.

Landmarks, a skip link, visible focus rings and keyboard shortcuts are built in:
- `/` or Ctrl+K for search;
- ← and → to move between lessons, ignored while typing or inside a simulation.
