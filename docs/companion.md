# Cache, the study companion

Cache is a small cat that lives on the floor of every page. It explains the current lesson in plain words, asks
Quick Revision questions from finished lessons, runs a focus timer (and plays during the breaks), shares the odd
fact from the lesson you are reading, naps on a little lamp and reacts (briefly) to progress. Everything runs
locally: there is no AI and no network call.

## Files

| File | Role |
|---|---|
| `components/companion/companion.tsx` | `Companion` root (mounted once in the root layout). Gates on hydration and the On/Off setting; wires position, behaviour, routines, bubble, menu, lamp, yarn and timer chip. |
| `lib/companion/behaviour.ts` | The state model: body phases, routine steps, `deriveMood()` (one pose from all state), `SIDE_MOODS`, `canActOnItsOwn()` (one guard for anything unprompted). |
| `components/companion/pixel-cat.tsx` | `PixelCat`: the cat as vector SVG parts posed with Motion, front view and the mosaic; its parts are in `components/companion/cat/`: `art.ts` (poses, paths, palette), `side-view.tsx` (the four-legged walk, crouch and leap), `accessories.tsx` (accessories and costumes) and `details.tsx` (eyes, mouth and the fish). |
| `components/companion/use-companion-position.ts` | The body state machine: drag (Motion), throw physics, landing, gait-based walking, jumping, perching, persistence of the position, resize handling. |
| `components/companion/use-companion-brain.ts` | Event bus listener, inactivity (sit, lamp, yawn, sleep, wake), greeting, lesson tips, focus-timer notices. |
| `components/companion/use-companion-routines.ts` | Topic meows and the end-of-lesson completion prompt (scheduling, observers, cleanup). |
| `components/companion/lamp.tsx` | The lamp nap routine (`useLampRoutine`) and the lamp drawing. |
| `components/companion/play.tsx` | Yarn chase (menu) and break-time play (`usePlay`), and the yarn ball. |
| `components/companion/companion-menu.tsx` | Keyboard-navigable `role="menu"` with the inline wardrobe and settings views. |
| `components/companion/speech-bubble.tsx` | Visible bubble plus `BubbleAnnouncer`, the single polite live region. |
| `components/companion/focus-timer.tsx` | `FocusTimer` chip (focus block, 5 min break; pause/resume, skip, stop). |
| `components/companion/focus-length.tsx` | Focus length control (5–120 min, persisted with the focus timer). |
| `components/companion/wardrobe.tsx` | `Wardrobe`: preview, item states (locked, available, selected, wearing, new) and `useNewAccessoryCount`. |
| `components/companion/companion-settings-panel.tsx` | `CompanionSettingsPanel` (dashboard, progress page, and inside the menu with `compact`). |
| `stores/companion-store.ts` | Runtime store (bubble, reaction, menu, idle level, activity, break-play opt-out, lamp wake signal, reset signal) and the persisted focus store (`STORAGE_KEYS.focus`). |
| `lib/companion/gait.ts` | Walk, trot and run: cadence, step length, leg and bob keyframes, walk plans and easing (pure). |
| `lib/companion/idle.ts` | Inactivity rules: `idleStep()` (pure). |
| `lib/companion/lamp-geometry.ts` | Where the lamp goes, the perch and the hop-down spot (pure). |
| `lib/companion/play-plan.ts` | Break-play game rotation and directions (pure). |
| `lib/learning/lesson-end.ts` | End-of-lesson rules: eligibility, "in view", reading time (pure). |
| `lib/companion/*` | Other pure logic: geometry, physics, lines (with no-repeat picking), topic facts, quiet-moment checks, actions, reactions, timings. |

Settings and the normalised position live in `stores/preferences-store.ts` (`companion`).

## State model

Two layers, each with exactly one current value (see `lib/companion/behaviour.ts`):

1. **Body** (`use-companion-position.ts`, exposed as `data-phase` on the root):

   ```
   resting ─drag→ dragging ─release→ flying ─settle→ landing ─→ resting      (throw, physics on)
                               └→ dropping ─arrive→ landing ─→ resting      (physics off / reduced motion)
   resting ─walk→ walking ─arrive→ resting                                    (whole steps; walk, trot or run)
   resting ─jump→ jumping ─arrive→ perched ─hop down→ jumping ─→ landing ─→ resting   (lamp)
   resting ─jump→ jumping ─→ landing ─→ resting                               (pounce)
   ```

   A press stops any move where she is; a resize keeps her at the same relative floor position.
   **She always stays where she lands**: nothing walks her back to a preset spot.

2. **Mind** (stores): idle level, nap, focus phase, reaction, routine step, bubble mood, and at most one
   **activity** (`play`, `lamp`, `break-play`; exposed as `data-activity`). The pose is derived from both layers by
   `deriveMood()`; it is never stored, so flags cannot disagree. Precedence: body motion > short reaction > routine step >
   bubble mood > nap / asleep > focus > idle level.

Everything unprompted (topic meows, the completion prompt, the idle lamp, break play) first asks `canActOnItsOwn()` (body
still, no menu, no bubble, no routine, no focus block, tab visible) and `pageIsBusy()` (typing, a dialog or popover,
selected text, an open knowledge check on screen, or a Try it block used in the last 12 s). Starting an activity replaces the
previous one, whose routine cleans up (animations stopped, timers cleared, the cat brought down to the floor).

## Poses

`data-mood` on the root (`data-testid="companion"`) is one of:

| Mood | Look | When |
|---|---|---|
| `idle` | sitting upright, tail up, occasional blink / tail flick / ear twitch | default |
| `sitting` | half-closed eyes, tail wrapped round the paws | 45 s without input, a focus break, settling on the lamp, resting between games |
| `walking` | side view on four legs, diagonal gait, body bob, tail sway, eyes looking ahead; mirrored when heading left | any walk, trot or run |
| `crouching` | side view, gathered low on bent legs, a wiggle of the hips, tail twitching | before the leap onto the lamp, before a pounce |
| `leaping` | side view, front legs reaching, hind legs pushing; nose up while rising, down while falling | a deliberate jump (lamp, pounce) |
| `jumping` | front view, stretched, legs dangling | the rising half of a throw |
| `falling` | ears back, legs out, bracing | dropping, or the falling half of a throw |
| `landing` | short squash (about 300 ms), then the resting pose | touching down, landing on the lamp |
| `yawning` | eyes closed, big open mouth | drifting off to sleep (1.3 s), on the lamp before the nap |
| `sleeping` | curled loaf, head down, closed eyes, drifting z's | 2 min without input, a nap, asleep on the lamp |
| `stretching` | long stretch with a yawn | waking up |
| `studying` | glasses and an open book | during a focus block; while explaining |
| `thinking` | paw on chin, thought bubble | revision questions, after a wrong answer, marking for review |
| `happy` | arc eyes, smile, blush, small hop | correct answer, lesson complete, after eating |
| `celebrating` | paws up, jump, sparkles | module or course complete, perfect quiz |
| `confused` | head tilt, one ear down, question mark | diagram events that report confusion |
| `dragged` | wide eyes, ears back, dangling paws, swings with drag speed | carried |
| `eating` | holding a fish in both paws and nibbling it | Feed |
| `purring` | arc eyes, blush, floating hearts | Pet |
| `playing` | wide eyes, paw out to bat | Play, break play |

Poses blend with springs; the front and side views cross-fade (0.16 s), so nothing snaps.

### Walking

`lib/companion/gait.ts` drives both the legs and the speed, so the paws stay planted:

- Diagonal leg pairs swing half a cycle apart. Legs have two segments (thigh and shin; the hind legs have a haunch).
- Stance: the leg is straight and sweeps back by exactly one step, linearly, matching the body's constant speed.
- Swing: the knee bends (the paw folds back and lifts), the thigh swings forward, and the leg straightens to reach
  for the next contact.
- The body rides the stance leg like an inverted pendulum: lowest at touch-down, highest at mid-stance, by exactly
  leg × (1 − cos angle), so the planted paw never leaves the floor line. The head cancels 60% of that bob, so it
  stays steadier than the body, as a cat's does.
- The legs are drawn crisp (outside the mosaic filter): thin parts that rotate every frame would otherwise be
  re-pixelated each frame and flicker between blocks.
- Walks are a whole number of steps (she stops with both pairs planted) with a gentle first and last step. The gait
  follows the distance:

| Gait | Cycle | Step (of cat size) | Leg swing / knee | Speed at 84 px |
|---|---|---|---|---|
| walk (up to 8 steps) | 0.54 s | 0.16 | ±28.5° (exact) / 46° | about 50 px/s |
| trot (up to 6 body lengths) | 0.38 s | 0.20 | ±34° / 56° | about 88 px/s |
| run (longer) | 0.28 s | 0.25 | ±38° / 64° | about 150 px/s |

The side view is drawn facing right and mirrored for left; the head stays turned to the viewer (a stylised cartoon
walk), leads the body and tips into the direction of travel. Speeds never depend on any page or Try it speed setting.

### Feeding

Feed drops a fish into her paws (a short spring), she nibbles it (two bites vanish from it), it ends as a fishbone,
then she looks happy and says a "nom" line (2.4 s in all). The fish is about a third of the cat's width, blue-silver
against the warm fur, outlined and with an eye, and stays visible for the whole sequence; it is drawn between the head
and the paws. Play stops first; with reduced motion the fish appears whole, without the bites.

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

### Inactivity and sleep

`lib/companion/idle.ts` holds the rules; the brain owns one re-arming timer. Meaningful activity resets it: keys,
pointer presses and moves, touch, wheel, scroll, and the tab becoming visible again.

- 45 s without input: she settles (`sitting`).
- 70 s (sometimes): the idle lamp nap (below).
- 2 min: a yawn, then sleep. Activity wakes her with a short stretch (and a "welcome back" after a long nap).
- She is kept awake while the menu is open, a bubble waits for an answer, a focus block runs, a modal dialog is
  open (e.g. a diagram lightbox), focus is in a text field or a knowledge check is in use. A routine (lamp, play,
  break play) owns her pose meanwhile; "Nap" (on request) is only ended by the menu, a tap or a pet.
  Reduced motion skips the yawn and stretch animations.

### Topic meows

On desktop, after about 80 s on a lesson and then every 3 to 4 minutes (at most three per visit), a short
"Meow fact". Facts come only from the open lesson: sentences the author highlighted with `<mark>`, glossary
terms the lesson defines, and its own building-block and trade-off lines (`lib/companion/topic-facts.ts`).
A fact is not repeated in the same browser session. Pause or resume from the menu, from the fact bubble, or
in settings (`companion.topicMeows`, persisted).

### Completion prompt

When the end of a lesson stays in view and the learner has spent a plausible time on it, Cache asks once whether to
mark it learned, with three explicit answers: **Mark as learned**, **Review later** (flags it for review; it is not
completed) and **Not yet**. Rules (`lib/learning/lesson-end.ts`):

- the end row (`[data-lesson-end="<slug>"]`, the "Mark as learned" row) is in view: at least half of it, or a big slice of
  a short viewport for a tall wrapped row; it must stay there for 2.2 s;
- the learner has been on the lesson for a quarter of its minutes (45 s to 4 min);
- the lesson is not learned and Cache has not asked about it before (`companion.completionAsked`, persisted);
- Cache is free (no other bubble, menu, drag or focus block). A knowledge check on screen right above the end does not
  block it (only using one does), and neither does break play. If Cache is busy at that moment it tries again every few
  seconds while the end stays in view.

Detection follows only the current lesson's marker (a marker left over from the previous page during client navigation is
never matched), re-finds it when the page re-renders (a frame-throttled MutationObserver) and follows layout changes through
an IntersectionObserver. The question is withdrawn if the lesson is marked by hand or the learner leaves the lesson.
Nothing is ever marked without an explicit answer.

### Lamp nap

Where there is room and motion is allowed: on desktop at least 700 px wide with the 84 px cat (as before), and on phones
and tablets any screen at least 300 px wide, with a smaller lamp beside the smaller cat. A phone's toolbars sliding in or
out while scrolling never wake her. Ways in:

- **Idle:** after 70 s without input, with a 60% chance per idle stretch. Keys, scrolling, touch, a press anywhere or
  coming back to the tab wake her; the mouse merely moving does not (so she can be reached and carried).
- **Menu:** "Lamp nap" in the Play group (shown only where the lamp can run). A nap on request: ordinary activity and
  opening the menu do not wake her; a tap, "Wake up" or a pet does.

The sequence: a lamp pops up 3–5 walk steps (plus a jump) away, on the side with room, towards the middle of the screen
(`lib/companion/lamp-geometry.ts`); she turns to it, walks those steps, crouches with a wiggle, leaps along an arc, lands
with a squash (the lamp wobbles and its face wakes up as the light comes on), settles, yawns and sleeps in the warm light.
On waking: a stretch, the lamp dims, a little crouch, a hop down beside it on the side towards the middle, a landing
squash, the lamp fades, and she stays where she landed.

**Carrying her asleep:** once she is asleep on the lamp, she can be dragged somewhere else without waking up. Pressing
her turns an idle nap into a nap on request (the drag is not "activity"); while carried the lamp hangs under her and she
keeps her sleeping pose; on release both drop straight down until the lamp stands on the floor (kept fully on screen),
the lamp wobbles, and she sleeps on. A tap without a drag still wakes her, and she hops down from the new spot.

Before she is asleep (walking over, leaping, settling, yawning), a drag, resize, press or another activity ends the
routine cleanly at any step (never leaving her in the air); every timer and subscription is cleaned up.

### Play and break play

- **Play** (menu): a yarn ball rolls away; she trots after it, bats it once more and sits back pleased.
- **Break play:** during a running focus break she plays by herself, games in turn (yarn chase, pounce, zoomies;
  `lib/companion/play-plan.ts`) with short rests between, until the break ends. Pressing or clicking her (or Enter /
  Space on the focused cat) stops it at once without opening the menu: she comes down to the floor where she is and
  rests, and play stays off for the rest of that break (`breakPlayOff`). Opening the menu, picking her up, pausing the
  break or reduced motion also stop it. It waits while a question bubble is open and while the tab is hidden.

## Menu

Click, tap, Enter or Space on the cat (ArrowDown/ArrowUp also open it). Arrow keys, Home and End move,
Escape closes and returns focus to the cat, Tab leaves. Items: Explain simply, Quick revision, Focus timer (shows the
chosen length), What should I learn next?, Meow about this topic, Pause / Resume topic meows, a "Play with Cache" group
(Wardrobe with a "N new" badge, Feed, Pet, Nap / Wake up, Lamp nap, Play), Hide companion, Companion settings.

## Drag, gravity and the floor

- Drag starts only from the cat button (`dragControls`, `touch-action: none` on the cat only), so page
  scrolling is never blocked. A click that ends a drag does not open the menu.
- On release she falls to the floor under constant gravity. The floor is the bottom of the viewport, or the
  top of the fixed bottom tab bar (`nav[aria-label=Main]`) on phones. Side edges are walls; the top is a
  ceiling only at the top of the page. rAF runs only in flight.
- The companion's frame hangs from the **bottom** of the viewport (`fixed bottom-0`, shifted up by the viewport
  height), so positions stay top-left viewport coordinates but the floor is the real bottom edge. Phone browsers move
  that edge while their toolbars slide in and out during scrolling, and Cache moves with it instead of floating above the
  tab bar or sinking below the screen. A same-width resize smaller than 160 px is treated as toolbars: she keeps her
  spot (standing, perched or mid-move).
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

## Focus timer

The block length is 5–120 minutes (25 by default), set in Companion settings and saved with the timer
(`focusMinutes` in `sdn-focus-v1`); a running block keeps its length. A 5-minute break follows (with break play).
The chip can pause and resume (paused time is added back to the end), skip and stop; all of it survives a refresh.

## Wardrobe

One item per slot (head, eyes, neck, body & costumes), drawn as vector layers that follow every pose, front and side.
Unlocks come from stored data (`lib/companion/accessories.ts`):

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
| `night-vigilante` ("Midnight vigilante") | body (costume) | 5 focus sessions |
| `web-hero` ("Web hero") | body (costume) | 10 lessons |

Layering: hats and eyewear ride on the head; **neckwear sits under the chin in front of the head** (so the head never
hides it, in any pose, including sleeping), drawn crisp with a dark outline; the gold chain is chunky alternating links
in a bright gold with a dark rim and a medallion, readable on the amber fur in both themes. Capes hang behind the body
(billowing while airborne, fluttering with the stride in side view) with clasps at the jaw. **Costumes** are original
designs with generic names and no logos or character artwork: the *Midnight vigilante* is a slate cowl with eye holes
over the brow and ears, a slate suit, a scalloped short cape, a gold belt and a crescent-moon emblem; the *Web hero* is a
red mask with thin web lines and large lenses (her eyes still show every expression), and a suit with blue sides, a red
chest with web lines and red gloves. Costumes recolour the fur layers through CSS variables, so they follow every pose.

States: locked (dashed, lock icon, requirement and a progress bar; can still be previewed), available, selected
(outlined, `aria-pressed`, shown on the preview cat), wearing (filled, check) and new (badge until the wardrobe is closed;
`companion.seenAccessories`). Picking an item previews it; "Wear it" / "Take off" commits. New unlocks are announced once
and show a dot on the cat and a "N new" badge on the menu's Wardrobe item.

## Look

Fur layers pass through an SVG mosaic filter (one sample per 5×5 viewBox units), so blocks are about 3.5 px at the 84 px
desktop size. Eyes, nose, mouth, whiskers, neckwear and fine costume details stay crisp. The filter only re-runs while
something animates. Costume and lamp colours are fixed art colours (the same in both themes); the fur follows the theme.

## Motion, accessibility and performance

- Motion follows the operating system's `prefers-reduced-motion` only. There is no site-wide animation-speed
  setting; animated Try it blocks have their own local 0.5x / 1x / 1.5x control, which never affects Cache.
  Reduced motion: no lamp, no break play, no throw; poses switch without tweens.
- The root is a labelled region; the cat is a real button with `aria-haspopup="menu"`; the only live output
  is one polite `role="status"` region carrying bubble text.
- No continuous animation at rest: idle micro-motions are one-shot animations every 3 to 8 s; legs loop only
  while walking; the physics loop runs only in flight. The focus chip ticks once a second only while a session
  runs unpaused. Every timer, observer, listener and animation is cleaned up when a routine ends, on unmount and on
  route change.

## Test hooks

- Root: `[data-testid="companion"]` with `data-mood`, `data-phase` (body state), `data-activity`
  (`play`, `lamp`, `break-play` or empty) and `data-resting="true|false"`.
- Cat button: `[data-testid="companion-cat"]`; its SVG has `data-view` (`front`, `side-walk`, `side-crouch`, `side-leap`)
  and, in side view, legs `[data-leg="near-front|near-hind|far-front|far-hind"]`;
  new-unlock dot `[data-testid="companion-new-dot"]`; the fish `[data-part="fish"]`.
- Menu items `[data-testid="companion-menu-<id>"]` (`explain`, `revise`, `focus`, `next`, `meow`, `topic-meows`,
  `wardrobe`, `feed`, `pet`, `nap`, `lamp`, `play`, `hide`, `settings`); sub-views
  `[data-testid="companion-menu-settings"]`, `[data-testid="companion-menu-wardrobe-view"]`; back `[data-testid="companion-menu-back"]`.
- Wardrobe: `[data-testid="accessory-<id>"]` with `data-state="locked|available|wearing"` and `aria-pressed` (selected);
  `[data-testid="wardrobe-preview"]` (`data-preview`), `[data-testid="wardrobe-action"]`.
- Lamp: `[data-testid="companion-lamp"]` with `data-lit`; yarn `[data-testid="companion-yarn"]`.
- Lesson end: `[data-lesson-end="<slug>"]`.
- Focus timer: `[data-testid="focus-timer"]` (`data-phase`, `data-paused`), `focus-timer-pause`, `focus-timer-skip`,
  `focus-timer-stop`; length `[data-testid="focus-length"] input`.
- Bubble actions `[data-bubble-action]`; announced text in the root's `[role="status"]`.

## Tests

`npm test` runs Node's built-in test runner over `scripts/tests/` (no extra dependencies; `support/load-app.mjs` transpiles
the app's TypeScript in memory): the state model, gait, inactivity, lamp plan, break play, end-of-lesson rules, the runtime
store's transitions, saved-data migration, the menu, and server-rendered sprite checks for every accessory and costume
(layering, side view, sleeping, the fish).

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
