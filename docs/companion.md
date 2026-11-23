# Cache, the study companion

Cache is a small cat that lives on the floor of every page. It explains the current lesson in plain
words, gives hints, asks Quick Revision questions from finished lessons, runs a focus timer, shares the
odd fact from the lesson you are reading and reacts (briefly) to progress. Everything runs locally:
there is no AI and no network call.

## Files

| File | Role |
|---|---|
| `components/companion/companion.tsx` | `Companion` root (mounted once in the root layout). Gates on hydration and the On/Off setting; wires position, behaviour, routines, bubble, menu, lamp and timer chip. |
| `lib/companion/behaviour.ts` | The state model: body phases and their transitions, `deriveMood()` (one pose from all state), `canActOnItsOwn()` (one guard for anything unprompted). |
| `components/companion/pixel-cat.tsx` | `PixelCat`: the cat as vector SVG parts posed with Motion; front view plus a four-legged side view for walking. |
| `components/companion/use-companion-position.ts` | The body state machine: drag (Motion), throw physics, landing, walking, jumping, perching, persistence of the position, resize handling. |
| `components/companion/use-companion-brain.ts` | Event bus listener, inactivity (sit, lamp, sleep, wake), greeting, lesson tips, focus-timer notices. |
| `components/companion/use-companion-routines.ts` | Topic meows and the end-of-lesson completion prompt (scheduling, observers, cleanup). |
| `components/companion/lamp.tsx` | The idle lamp routine (`useLampRoutine`) and the lamp drawing. |
| `components/companion/companion-menu.tsx` | Keyboard-navigable `role="menu"` with the inline wardrobe and settings views. |
| `components/companion/speech-bubble.tsx` | Visible bubble plus `BubbleAnnouncer`, the single polite live region. |
| `components/companion/focus-timer.tsx` | `FocusTimer` chip (focus block, 5 min break; pause/resume, skip, stop). |
| `components/companion/focus-length.tsx` | Focus length control (5–120 min, persisted with the focus timer). |
| `components/companion/wardrobe.tsx` | `Wardrobe`: preview, item states (locked, available, selected, wearing, new) and `useNewAccessoryCount`. |
| `components/companion/companion-settings-panel.tsx` | `CompanionSettingsPanel` (dashboard, progress page, and inside the menu with `compact`). |
| `stores/companion-store.ts` | Runtime store (bubble, reaction, menu, idle level, activity, reset signal) and the persisted focus store (`STORAGE_KEYS.focus`). |
| `lib/companion/*` | Pure logic: geometry, physics, lines (with no-repeat picking), topic facts, quiet-moment checks, actions, reactions, timings. |

Settings and the normalised position live in `stores/preferences-store.ts` (`companion`).

## State model

Two layers, each with exactly one current value (see `lib/companion/behaviour.ts`):

1. **Body** (`use-companion-position.ts`, exposed as `data-phase` on the root):

   ```
   resting ─drag→ dragging ─release→ flying ─settle→ landing ─→ resting      (throw, physics on)
                               └→ dropping ─arrive→ landing ─→ resting      (physics off / reduced motion)
   resting ─walk→ walking ─arrive→ resting
   resting ─jump→ jumping ─arrive→ perched ─hop down→ jumping ─→ landing ─→ resting   (lamp)
   ```

   A press stops any move where she is; a resize keeps her at the same relative floor position.
   **She always stays where she lands**: nothing walks her back to a preset spot.

2. **Mind** (stores): idle level, nap, focus phase, reaction, routine step, bubble mood. The pose is
   derived from both layers by `deriveMood()`; it is never stored, so flags cannot disagree.
   Precedence: body motion > short reaction > routine step > bubble mood > nap / asleep > focus > idle level.

Everything unprompted (topic meows, the completion prompt, the lamp) first asks `canActOnItsOwn()` (body
still, no menu, no bubble, no routine, no focus block, tab visible) and `pageIsBusy()` (typing, a dialog or
popover, selected text, an open knowledge check on screen, or a Try it block used in the last 12 s).

## Poses

`data-mood` on the root (`data-testid="companion"`) is one of:

| Mood | Look | When |
|---|---|---|
| `idle` | sitting upright, tail up, occasional blink / tail flick / ear twitch | default |
| `sitting` | half-closed eyes, tail wrapped round the paws | 45 s without input, a focus break, sitting on the lamp |
| `walking` | side view on four legs (diagonal gait), head turned to the viewer, tail up; mirrored when walking left | any walk |
| `sleeping` | curled loaf, head down, closed eyes, drifting z's | 2 min without input, a nap, asleep on the lamp |
| `studying` | glasses and an open book | during a focus block; while explaining or summarising |
| `thinking` | paw on chin, thought bubble | hints, revision questions, after a wrong answer, marking for review |
| `happy` | arc eyes, smile, blush, small hop | correct answer, lesson complete, petting |
| `celebrating` | paws up, jump, sparkles | module or course complete, perfect quiz |
| `confused` | head tilt, one ear down, question mark | diagram events that report confusion |
| `dragged` | wide eyes, ears back, dangling paws, swings with drag speed | carried |
| `falling` | ears back, legs out, bracing | dropping, or the falling half of a throw |
| `jumping` | stretched body, legs reaching | rising half of a throw, a deliberate jump |
| `landing` | short squash (280 ms), then back to the resting pose | touching down |
| `crouching` | gathered low | just before jumping onto the lamp |
| `stretching` | long stretch with a yawn | waking on the lamp |
| `eating` | head down, chewing, fish at her paws | Feed |
| `purring` | arc eyes, blush, floating hearts | Pet |
| `playing` | wide eyes, paw out to bat | Play |

Poses blend with springs; the front and side views cross-fade (0.16 s), so nothing snaps.

## Behaviour

- Events (`onCompanionEvent`): `lesson-complete` (praise with progress and the next lesson; module and
  course completion celebrate with a link), `quiz-answer` (pose every time; a bubble at most every 20 s),
  `quiz-finished` (score line), `review-marked` (a short line at most once a minute), `diagram`,
  `lesson-opened` (the lesson's tip after 2.5 s, once per lesson per page load).
- Lines come from `lib/companion/lines.ts` through `pickFresh()`: within a category every line is used
  before any repeats, and the last 24 lines said are remembered for the browser session.
- Tips and nudges (greeting, lesson tips, topic meows, completion prompt, diagram comments, welcome back)
  need Study tips on and share a 90 s budget. The greeting mentions topics marked for review.
- During a focus block Cache only changes pose: no unprompted bubbles.

### Topic meows

On desktop, after about 80 s on a lesson and then every 3 to 4 minutes (at most three per visit), a short
"Meow fact". Facts come only from the open lesson: sentences the author highlighted with `<mark>`, glossary
terms the lesson defines, and its own building-block and trade-off lines (`lib/companion/topic-facts.ts`).
A fact is not repeated in the same browser session. Pause or resume from the menu, from the fact bubble, or
in settings (`companion.topicMeows`, persisted).

### Completion prompt

When the end of a lesson (`[data-lesson-end]`, the "Mark as learned" row) stays in view for 2.2 s and the
learner has spent a plausible time on the page (a quarter of the lesson's minutes, 45 s to 4 min), Cache asks
once whether to mark it learned. Only "Mark as learned" marks it. It never asks about a learned lesson and
never asks twice about the same lesson (`companion.completionAsked`, persisted).

### Idle lamp

Desktop only (fine pointer, at least 700 px wide, motion allowed). After 70 s without input, with a 60%
chance per idle stretch, a lamp fades in beside her: she walks over, crouches, jumps onto the shade and sits in
its warm light; at 2 minutes she falls asleep there. Any activity wakes her: a stretch, a hop down beside the
lamp, the lamp fades, and she stays where she landed. A drag, resize or press ends the routine cleanly at any step.

## Menu

Click, tap, Enter or Space on the cat (ArrowDown/ArrowUp also open it). Arrow keys, Home and End move,
Escape closes and returns focus to the cat, Tab leaves. Items: Explain simply, Give me a hint, Quick revision,
Focus timer (shows the chosen length), Current topic summary, What should I learn next?, Meow about this topic,
Pause / Resume topic meows, a "Play with Cache" group (Wardrobe with a "N new" badge, Feed, Pet, Nap / Wake up,
Play), Hide companion, Companion settings.

## Drag, gravity and the floor

- Drag starts only from the cat button (`dragControls`, `touch-action: none` on the cat only), so page
  scrolling is never blocked. A click that ends a drag does not open the menu.
- On release she falls to the floor under constant gravity. The floor is the bottom of the viewport, or the
  top of the fixed bottom tab bar (`nav[aria-label=Main]`) on phones. Side edges are walls; the top is a
  ceiling only at the top of the page. rAF runs only in flight.
- Where she lands, she stays: the floor x is stored normalised (`{ x, y: 1, floor: true }`) and restored at the
  same relative spot after refresh, navigation and resize, always fully on screen. "Reset position" in
  settings is the only thing that walks her back to the corner.

| Constant (`lib/companion/physics.ts`) | Desktop | Phone |
|---|---|---|
| Max throw speed | 1700 px/s | 1050 px/s |
| Gravity | 1850 px/s² | 1700 px/s² |
| Air drag (horizontal) | 0.55 /s | 0.8 /s |
| Wall / ceiling restitution | 0.4 / 0.35 | 0.22 / 0.22 |
| Floor restitution, min bounce | 0.28, 150 px/s | 0.2, 160 px/s |
| Floor friction, stop speed | 1400 px/s², 10 px/s | 2000 px/s², 12 px/s |

- Reduced motion or Physics off: a quick straight drop, no throw or bounce.
- Walking speed is 150 px/s (130 on phones). It never depends on any page or Try it speed setting.

## Focus timer

The block length is 5–120 minutes (25 by default), set in Companion settings and saved with the timer
(`focusMinutes` in `sdn-focus-v1`); a running block keeps its length. A 5-minute break follows. The chip can
pause and resume (paused time is added back to the end), skip and stop; all of it survives a refresh.

## Wardrobe

One accessory per slot (head, eyes, neck, body), drawn as vector layers that follow every pose (simplified
versions on the walking side view). Unlocks come from stored data (`lib/companion/accessories.ts`):

| Id | Slot | Unlock |
|---|---|---|
| `bell-collar` | neck | first lesson completed |
| `bow-tie` | neck | one focus session completed |
| `gold-chain` | neck | perfect score on 3 different knowledge checks |
| `bandana` | neck | fed or played with Cache 5 times |
| `party-hat` | head | 5 lessons |
| `wizard-hat` | head | any module completed |
| `graduation-cap` | head | all lessons |
| `round-glasses` | eyes | perfect score on any knowledge check |
| `sunglasses` | eyes | 10 flashcards marked known |
| `striped-sweater` | body | 20 lessons |
| `hero-cape` | body | 3 modules |

States: locked (dashed, lock icon, requirement and a progress bar; can still be previewed), available,
selected (outlined, `aria-pressed`, shown on the preview cat), wearing (filled, check) and new (badge until the
wardrobe is closed; `companion.seenAccessories`). Picking an item previews it; "Wear it" / "Take off" commits.
Discoverability: a dot on the cat and a "N new" badge on the menu's Wardrobe item while unseen unlocks exist.

## Look

Fur layers pass through an SVG mosaic filter (one sample per 5×5 viewBox units), so blocks are about 3.5 px
at the 84 px desktop size. Eyes, nose, mouth and whiskers stay crisp. The filter only re-runs while something animates.

## Motion, accessibility and performance

- Motion follows the operating system's `prefers-reduced-motion` only. There is no site-wide animation-speed
  setting; animated Try it blocks have their own local 0.5x / 1x / 1.5x control, which never affects Cache.
- The root is a labelled region; the cat is a real button with `aria-haspopup="menu"`; the only live output
  is one polite `role="status"` region carrying bubble text.
- No continuous animation at rest: idle micro-motions are one-shot animations every 3 to 8 s; legs loop only
  while walking; the physics loop runs only in flight. The focus chip ticks once a second only while a session
  runs unpaused. Every timer, observer and listener is cleaned up on unmount and route change.

## Test hooks

- Root: `[data-testid="companion"]` with `data-mood`, `data-phase` (body state) and `data-resting="true|false"`.
- Cat button: `[data-testid="companion-cat"]`; new-unlock dot `[data-testid="companion-new-dot"]`.
- Menu items `[data-testid="companion-menu-<id>"]` (`explain`, `hint`, `revise`, `focus`, `summary`, `next`,
  `meow`, `topic-meows`, `wardrobe`, `feed`, `pet`, `nap`, `play`, `hide`, `settings`); sub-views
  `[data-testid="companion-menu-settings"]`, `[data-testid="companion-menu-wardrobe-view"]`; back `[data-testid="companion-menu-back"]`.
- Wardrobe: `[data-testid="accessory-<id>"]` with `data-state="locked|available|wearing"` and `aria-pressed` (selected);
  `[data-testid="wardrobe-preview"]` (`data-preview`), `[data-testid="wardrobe-action"]`.
- Lamp: `[data-testid="companion-lamp"]` with `data-lit`.
- Focus timer: `[data-testid="focus-timer"]` (`data-phase`, `data-paused`), `focus-timer-pause`, `focus-timer-skip`,
  `focus-timer-stop`; length `[data-testid="focus-length"] input`.
- Bubble actions `[data-bubble-action]`; announced text in the root's `[role="status"]`.

## Future work (genuine AI, not implemented)

These would need a model behind an API; none of them should ship as canned text pretending to be AI.

- Free-form questions about the current lesson, answered from the lesson's own MDX (retrieval over the
  143 lessons) with citations back to sections.
- Explain-it-differently: regenerate `explainSimply` at a chosen level (beginner, interview prep) or
  with a learner-chosen analogy.
- Adaptive revision: pick recall questions with spaced repetition from quiz history, and generate new
  variants of a recall question so the learner cannot memorise the wording.
- Grading open answers: let the learner type an answer to the recall question and get feedback on what
  is missing compared with the reference answer.
- Design review for the practice module: critique a learner's URL-shortener or chat design against the
  playbook, pointing at the lesson that covers each gap.
- Study planning: suggest a weekly plan from visit and completion history and the time the learner has.
