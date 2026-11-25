/* What Cache says. Plain strings, picked locally; no generated text and no invented facts. */

export const LINES = {
  correct: ["Correct!", "Yes. Purr.", "Nailed it.", "Right on.", "That is the one.", "Mrrp! Spot on.", "Exactly that.", "Nailed it, {you}."],
  incorrect: [
    "Close one. Read the why below; a miss sticks better than a lucky guess.",
    "Not this time. The explanation is the good part.",
    "Oops. Now you will never forget it.",
    "Wrong answers are cheap here. Read why, then keep going.",
    "Hmm, not quite. The explanation names the trap.",
    "A useful miss. Read the reasoning, then carry on.",
  ],
  lessonDone: [
    "Box unlocked! That is {done} of {total}.",
    "Purr-fect. {pct} of the way there.",
    "Another building block in place. {done} of {total} learned.",
    "Learned! Ask me for a quick revision question later and we will see if it stuck.",
    "Tail up! {done} down, {left} to go.",
    "One more box on the diagram. Nicely done.",
    "Mrrp! That one is in your toolkit now.",
    "Nice work, {you}. {done} of {total} learned.",
    "Look at you go, {you}. {left} to go.",
  ],
  quizPerfect: "{score}/{total}! Flawless, {you}. I am impressed, and I am a cat.",
  quizGood: "{score}/{total}. Solid. Retake it tomorrow and watch it climb.",
  quizLow: "{score}/{total}. That is what checks are for: reread the explanations, then try again later.",
  greetNew:
    "Hi {you}, I'm Cache! Click me for a simple explanation, quick revision or a focus timer. You can drag me anywhere.",
  greetBack: [
    "Welcome back! Pick up where you left off?",
    "Mrrp, you're back! Shall we carry on?",
    "There you are. I kept your seat warm.",
    "Hello again! Ready for the next box?",
    "Welcome back, {you}! Pick up where you left off?",
    "Oh, it's {you}. I suppose we can learn something.",
  ],
  greetStudying: [
    "Welcome back! Good to see you studying again.",
    "Back for more? I like your style.",
    "Purr. Same time, same cat. Let's learn.",
    "Back for more, {you}? I like your style.",
  ],
  reviewWaiting: [
    "You have {n} topics marked for review. A quick revisit makes them stick.",
    "{n} topics are waiting in your review list. Pick one when you are ready.",
  ],
  reviewWaitingOne: [
    "One topic is marked for review. A quick revisit makes it stick.",
    "There is one topic in your review list, ready when you are.",
  ],
  reviewMarked: [
    "Flagged for later. I will keep it warm.",
    "Noted. It is in your review list now.",
    "Marked for review. Coming back to it is how it sticks.",
    "Good call. Topics you revisit stay with you longer.",
  ],
  reviewCleared: ["Off the review list. Purr.", "Reviewed and done. Nice.", "One less to revisit. Tail up!"],
  encourage: [
    "Small steps, box by box.",
    "You're doing great. One building block at a time.",
    "Stuck? Ask me to explain it simply. No shame in it.",
    "Every expert once asked what a load balancer is.",
    "Steady reading beats speed reading.",
  ],
  focusStart: [
    "{min} minutes of focus starts now. I will study quietly next to you.",
    "Focus on: {min} minutes. I will keep my paws to myself.",
    "{min} minutes, starting now. Quiet mode on.",
  ],
  focusStop: ["Timer stopped. Good effort.", "Stopped. Any focus counts.", "Timer off. Stretch your paws."],
  focusPaused: ["Paused. I will wait right here.", "Timer paused. Take your time."],
  focusResumed: ["Back to it. The timer is running again.", "Resumed. Quiet mode on."],
  focusDone: [
    "Focus block done. Take five: stand up, stretch, look at something far away. I am timing your break.",
    "Done! Five minutes off now: water, a stretch, eyes on something distant.",
    "That is a full block. Break time: move a little, rest your eyes.",
  ],
  breakDone: ["Break over. Ready for another round?", "Break's up. Shall we go again?", "Rested? Another block whenever you like."],
  meowGeneric: [
    "Mrrp! Open a lesson and I will meow about it.",
    "Purr. Every box on a diagram needs a reason. Same for every nap.",
    "Meow. Small steps, box by box, and one treat per lesson.",
    "I'm a cache: I keep the hot facts close and the cold ones on disk.",
    "Prrrt. Head scratches recharge my cache.",
  ],
  nom: [
    "Nom nom nom. Fish: cached.",
    "Nom! That hit the spot, like a warm cache.",
    "Crunch crunch. Thank you, human.",
    "Mmm. Fresh fish, low latency.",
    "Nom. Hunger requests: served.",
    "Tasty. I will remember this, with a long TTL.",
  ],
  pet: [
    "Purrrr. Right behind the ears, please.",
    "Prrrt. That is the spot.",
    "Purr. You are a good human.",
    "Mrrrr. More scratches, fewer bugs.",
    "Purr. My happiness metric just went up.",
    "Prrr. Do that again. I will wait.",
    "Purr. Acceptable scratching, {you}.",
  ],
  napStart: ["Nap time. Wake me from the menu, or give me a pat.", "Curling up. A pat or the menu wakes me.", "Zzz soon. Tap me when you need me."],
  wake: ["Mrrp! I'm up. What are we learning?", "Yawn. Okay, I'm awake!", "Stretch... and back. What's next?", "Mrrp. Oh, it's you, {you}. What are we learning?"],
  lampWake: ["Mrrp! Warm lamp, good nap.", "Yawn. That lamp is the best spot in the house.", "Oh, you're back. I was guarding the lamp."],
  lampNap: [
    "My lamp! Tap me when you need me.",
    "Lamp nap time. A tap or the menu wakes me.",
    "Off to my warm lamp. Wake me with a tap.",
  ],
  lampNoRoom: ["No room for my lamp here. Drag me somewhere roomier and ask again.", "Hmm, my lamp won't fit here. Move me a little and try again."],
  breakPlayStart: ["Break time! Watch me play.", "Five minutes off. Yarn time!", "Break! I'm going to chase things."],
  breakPlayStop: ["Okay, okay. Sitting nicely now.", "Fine, I'll rest. Enjoy your break.", "Paws down. Enjoy the rest of your break."],
  playDone: [
    "Got it! Best yarn ever.",
    "Pounce! Yarn: defeated.",
    "Again? Again! (Later. I'm a cat.)",
    "Caught it. Reflexes: low latency.",
    "Yarn secured. Victory purr.",
  ],
  completionAsk: [
    "You reached the end of {title}. Shall I mark it as learned?",
    "That's the end of {title}. Mark it as learned?",
    "All the way through {title}! Want to mark it as learned?",
  ],
  completionLater: ["Okay, I won't ask about this one again. The button is at the end of the lesson.", "Sure. You can mark it any time with the button at the end."],
  completionReview: ["Flagged for review. It's waiting in your review list.", "Marked for review. Come back to it whenever you like."],
  topicPaused: "Topic meows paused. Resume them from my menu whenever you like.",
  topicResumed: "Topic meows back on. I will share a fact from the lesson now and then.",
  signedIn: [
    "Signed in. Welcome, {you}! Your progress now follows you to any device.",
    "Mrrp! Hello, {you}. I will keep your progress safe in your account.",
    "Signed in. Your boxes are backed up now, {you}. Purr.",
  ],
  homeTips: [
    "Start simple, then find what breaks. That is the whole course in one sentence.",
    "Whenever you meet a new box, ask: what problem forced this in?",
    "The database usually breaks first, because nearly every request becomes a query.",
    "Ten focused minutes beat an hour of tab-hopping. Try my focus timer.",
  ],
} as const;

/** Every multi-line category, for pickFresh. */
export type LineCategory = { [K in keyof typeof LINES]: (typeof LINES)[K] extends readonly string[] ? K : never }[keyof typeof LINES];

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/* ------------------------------------------------------------------ no repeats */

const HISTORY_KEY = "sdn-companion-recent-lines";
/** Lines remembered across the whole companion, so the same sentence never comes back soon. */
const GLOBAL_MEMORY = 24;
let recent: string[] | null = null;

function loadRecent(): string[] {
  if (recent) return recent;
  recent = [];
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(HISTORY_KEY) : null;
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) recent = parsed.filter((v): v is string => typeof v === "string").slice(-GLOBAL_MEMORY);
  } catch {
    // Storage blocked or malformed: start empty.
  }
  return recent;
}

function remember(line: string): void {
  const list = loadRecent();
  const i = list.indexOf(line);
  if (i >= 0) list.splice(i, 1);
  list.push(line);
  if (list.length > GLOBAL_MEMORY) list.splice(0, list.length - GLOBAL_MEMORY);
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Not persisted this time; the in-memory history still works.
  }
}

/**
 * A line from `list` that was not used recently. Within a category every line is used once before any
 * repeats (oldest first); the history survives reloads for the browser session.
 */
export function pickFresh(list: readonly string[]): string {
  if (!list.length) return "";
  const history = loadRecent();
  const unused = list.filter((l) => !history.includes(l));
  let choice: string;
  if (unused.length) choice = pick(unused);
  else {
    // All used: take the one said longest ago.
    choice = list.reduce((best, l) => (history.indexOf(l) < history.indexOf(best) ? l : best), list[0]);
  }
  remember(choice);
  return choice;
}

/* ------------------------------------------------------------------ what Cache calls the learner */

/** Used when the learner has not told Cache what to call them. */
export const DEFAULT_YOU = "hooman";
let youSource: () => string = () => DEFAULT_YOU;

/** Where {you} comes from (the profile); set once by the companion, so this file stays free of imports. */
export function setYouSource(source: () => string): void {
  youSource = source;
}

/** What Cache calls the learner right now. */
export function you(): string {
  try {
    return youSource().trim() || DEFAULT_YOU;
  } catch {
    return DEFAULT_YOU;
  }
}

/** pickFresh for a named category, with {you} filled in. */
export function line(category: LineCategory): string {
  return fill(pickFresh(LINES[category] as readonly string[]), {});
}

/** Replace {key} placeholders; {you} is always available (what Cache calls the learner). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : key === "you" ? you() : match));
}

/** Testing hook: forget the history. */
export function resetLineHistory(): void {
  recent = [];
  try {
    window.sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
