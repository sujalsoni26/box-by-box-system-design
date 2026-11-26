import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-elevator",
  title: "Design an elevator system",
  track: "lld",
  level: "intermediate",
  minutes: 35,
  scenario: "A building has 20 floors and 4 cars. Each landing has up and down buttons; each car has a button per floor, door-open and emergency stop; a technician can take a car out of service. Design the controller so that every hall call goes to exactly one car, no call waits forever, safety overrides scheduling, and one failed car never stops the others.",
  focus: "Separating three decisions candidates usually tangle: which car takes a hall call, which floor a car stops at next, and whether the car may move at all.",
  concepts: ["interfaces-abstractions-di", "design-patterns-behavioural", "concurrency-basics", "testing-extensibility", "lld-vending-machine"],
  steps: [
    {
      prompt: "What is in scope, and what simplified model of time and motion would you assume so that the design can be tested?",
      hint: "Real lifts have acceleration curves, destination panels and fire-service recall. Ask which of those change the core decisions, and what discrete model could stand in for the physics.",
      insight: "In scope: hall calls by floor and direction, car calls, doors with a dwell time and obstruction sensor, overload, maintenance with reassignment, and landing displays. Assume one controller process and discrete ticks of one floor per tick with doors open for three ticks; destination dispatch, express zones, fire recall and real acceleration are out.",
    },
    {
      prompt: "A first draft puts everything in one Elevator.move() method. Which separate decisions are hiding in it, and which object should own each?",
      hint: "Follow one hall call from the button press. Something chooses a car once; then, on every tick, something chooses where that car goes next; and before any motion, something must say whether moving is allowed at all.",
      insight: "A Dispatcher chooses the car for a hall call, a SchedulingPolicy chooses each car's next stop, and a CarMode guard on the car decides whether it may move. The ElevatorController receives calls, runs the tick and reassigns calls from cars leaving service; each ElevatorCar owns its floor, heading, mode, door and pending stops.",
    },
    {
      prompt: "How should a car store its pending stops so that 'next stop in my direction' and 'where do I turn round' are both cheap?",
      hint: "A car heading up ignores down calls until it turns. What if pending stops were split by the direction in which they will be served, and kept in order?",
      insight: "Two sorted sets, upStops and downStops. Heading up, the next stop is one ceiling(floor) lookup and the turning point is the highest down stop, so every decision is a navigation call; a repeated button press is idempotent for free.",
    },
    {
      prompt: "Which rule should pick a car's next stop: nearest request first, SCAN or LOOK? What failure does the first one have?",
      hint: "Imagine steady traffic between floors 2 and 6 while someone waits on floor 19. Then compare a bus that always drives to the terminus with one that turns after its last passenger's stop.",
      insight: "Nearest-first can starve a far floor for as long as nearer requests keep arriving. SCAN sweeps to the terminal floor and LOOK turns at the last pending stop; both bound every wait to about two sweeps, and LOOK wastes less empty travel, so it is the default behind a SchedulingPolicy Strategy that also lets SCAN run against the same simulated traffic.",
    },
    {
      prompt: "Normal, overloaded, maintenance and emergency stop: should these be State classes, as in the vending machine?",
      hint: "List what each non-normal mode actually does when a tick arrives. If the answers are the same, how much would each class contain?",
      insight: "An enum with one guard at the top of step() is the honest choice: every non-normal mode does the same thing, refuse to move and tick the door, so four State classes would hold one line each. Modes become State-worthy only when one gains real behaviour, such as fire-service recall driving the car to a set floor.",
    },
    {
      prompt: "Many button threads, one ticker and a technician console all touch a car. What do you lock, at what granularity, and what can still go wrong with the ticker itself?",
      hint: "TreeSet is not thread-safe. Ask whether cars share state with each other, whether dispatch needs an exact answer, and what a ScheduledExecutorService does after a periodic task throws.",
      insight: "One ReentrantLock per car guards its floor, heading, mode and stop sets; no thread holds two car locks, so there is no deadlock, and dispatch reads slightly stale estimates, which costs ticks, not correctness. A periodic task that throws suppresses every later run, so each car's step is wrapped in a try that emergency-stops that car instead of silently freezing the whole building.",
    },
    {
      prompt: "A technician takes a car out of service while it has pending hall calls and passengers inside who have pressed floors. What happens to each kind of call?",
      hint: "Ask which calls another car could serve, and which only make sense for the people already in this car.",
      insight: "The controller re-dispatches the hall calls; car calls cannot be moved, because nobody else knows who pressed them, so the car goes to the nearest floor, opens and asks passengers to step out. If every car is out, calls wait in the controller's unassigned queue, and each assignment carries a deadline in ticks so a stuck car's calls are re-dispatched.",
    },
  ],
  tradeoffs: [
    "LOOK vs SCAN: choose LOOK for less empty travel and a shorter average wait; SCAN gives more predictable waits for the far floors.",
    "Nearest-car dispatch vs a load-balancing or zone-aware dispatcher: choose nearest-car for fast, explainable assignment, knowing cars bunch under heavy traffic, and swap the Dispatcher when that shows up.",
    "A lock per car vs a single-threaded event loop: choose the lock per car because cars never wait for each other; choose the event loop when you want no locks and a replayable day of traffic, accepting that one slow handler delays every car.",
  ],
  followUps: [
    "How does destination dispatch, where passengers type their floor on the landing, change the design?",
    "Rewrite the controller as a single-threaded event loop. What do you gain and what do you lose?",
    "A call arrives for the floor the car is just about to pass. What does a real controller do that the tick model hides?",
    "Where would a rule that parks idle cars at the lobby to save energy live?",
  ],
};
