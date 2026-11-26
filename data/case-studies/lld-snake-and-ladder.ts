import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-snake-and-ladder",
  title: "Design Snake and Ladder",
  track: "lld",
  level: "basic",
  minutes: 20,
  scenario: "Two to four players take turns rolling a die and moving tokens on a 100-cell board with snakes and ladders placed at setup; the first to reach the last cell wins. House rules, such as what happens when a roll passes the last cell and whether a six earns another turn, must be configuration rather than code changes. A test must be able to say 'roll a 4, then a 6' and assert where a token ends up.",
  focus: "Making a game of chance deterministic under test, and modelling snakes, ladders and rule variants so the game loop stays a few lines with no branching on piece type or house rule.",
  concepts: ["oop-pillars", "class-relationships-uml", "design-patterns-creational", "design-patterns-behavioural", "error-handling", "testing-extensibility"],
  steps: [
    {
      prompt: "What is in scope, what should be configuration, and which non-functional requirements matter most in a basic problem like this?",
      hint: "In this round the interviewer is checking responsibilities and relationships, not cleverness. Think about what makes a dice game hard to test, and when an impossible board ought to be caught.",
      insight: "In scope: two to four players, an n-cell board with snakes and ladders, turns in order, first to the last cell wins; the overshoot rule and the extra turn on a six are configuration. The requirements that shape the design are determinism under test and rejecting an impossible board before the first turn; a user interface, saved games and computer opponents are out.",
    },
    {
      prompt: "List the entities with one responsibility each. Does a cell deserve its own class?",
      hint: "A class earns its place with behaviour or an invariant. What does a cell number have of either, and what does the board actually need to answer about a cell?",
      insight: "Board knows its size and the jumps keyed by start cell and answers destination(cell); Snake and Ladder share one Jump interface; Dice rolls; Player has a name and position; GameRules holds the variants; Game runs the turn; BoardBuilder validates setup. A cell is just an int, with no behaviour or invariant, and saying so beats drawing a hundred objects that do nothing.",
    },
    {
      prompt: "How does the board handle snakes and ladders without asking which one it has, and where do you make a snake that goes up impossible?",
      hint: "Both move a token from one cell to another. Decide which direction rule belongs to each, and at what moment a wrong one should be refused.",
      insight: "Both implement Jump with start() and end() and sit in a map keyed by start cell, so destination(cell) is one lookup with no branching on type. Each is a record that validates its direction in its constructor, so a snake whose tail is not below its head can never be built.",
    },
    {
      prompt: "How do you write a test that says 'roll a 4, then a 6'? Would a seeded Random be enough?",
      hint: "Find the one source of nondeterminism and put it behind a seam. Compare a test that states the rolls it needs with one that searches for a seed that happens to produce them.",
      insight: "Dice is an interface with RandomDice for play and FixedDice, a scripted fake, for tests; the composition root chooses the real one and the fake lives in the test sources. A seeded Random reproduces a whole game, which helps replay a bug report, but the fake is the better unit-testing tool because the test states the rolls it needs.",
    },
    {
      prompt: "Where do the overshoot rule and the extra turn on a six live, and which boards should be rejected before the first turn?",
      hint: "The overshoot rule has three variants with no state of their own. For validation, think about a cell no token could ever get past, a cell no token lands on, and two jumps competing for one cell.",
      insight: "OvershootRule is an enum with a resolve method (WIN, STAY, BOUNCE), the lightest form of Strategy, held with extraTurnOnSix in GameRules. BoardBuilder.build rejects a snake head on the last cell, a jump starting on cell 0, two jumps from one cell and a one-cell board, throwing IllegalArgumentException so a bad board never reaches a turn.",
    },
    {
      prompt: "Write one turn in pseudocode. A bounce lands on a snake's head, and a ladder's top is another snake's head: what happens in each case? Is there any concurrency to design?",
      hint: "Decide the order of 'resolve the overshoot' and 'follow a jump', and whether jumps chain. Chains raise a question about cycles.",
      insight: "A turn takes the player at the front of a deque, rolls, resolves the overshoot, follows one jump, checks for a win, and puts the player at the back, or the front on a six with the rule on. The jump applies after the bounce, and jumps are followed once by default because chains need cycle detection and should be opt-in; the game is turn-based and single-threaded, and saying 'no concurrency' is the right answer.",
    },
  ],
  tradeoffs: [
    "Dice behind an interface vs calling Random directly: choose the interface for deterministic tests and swappable randomness, at the cost of an interface and a fake for a one-line method.",
    "Jumps as a map by start cell vs an array of destinations: choose the map because it is sparse and easy to validate in the builder; an array of 101 destinations would be simpler and faster for a fixed board.",
    "Follow a jump once vs follow chains: choose once for no cycles and simple reasoning, accepting that some house rules expect chains.",
  ],
  followUps: [
    "Add a 'miss a turn' cell. When would you generalise Jump into a CellEffect, and why not before?",
    "Players now join over a network. How do you keep the single-threaded design?",
    "A player leaves mid-game. What happens, especially when only two were playing?",
    "How would you add undo?",
  ],
};
