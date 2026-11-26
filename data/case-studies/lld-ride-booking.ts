import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-ride-booking",
  title: "Design a ride-booking service",
  track: "lld",
  level: "advanced",
  minutes: 45,
  scenario: "Inside one city's matching process, riders request a ride with a pickup, a drop and a vehicle category; the system ranks nearby available drivers and offers the trip to one at a time, each with 15 seconds to accept. The trip moves through requested, assigned, en route, started and completed; either side may cancel before it starts, with a fee that depends on the state; fares include surge. About 50,000 drivers are online at peak and 1,000 requests arrive a minute, and a driver must never be offered or assigned two trips at once.",
  focus: "Making the trip an explicit state machine whose transitions are the only way it changes, and treating the driver as a contested resource that a trip claims atomically before the offer is sent.",
  concepts: ["design-patterns-behavioural", "design-patterns-structural", "concurrency-basics", "design-uber", "lld-parking-lot", "lld-task-scheduler"],
  steps: [
    {
      prompt: "What do you include in a code-level ride-booking design, and which non-functional requirements shape it?",
      hint: "Separate the matching process from maps, routing, payments and city-scale sharding. Then think about offers nobody answers, and about location updates that vastly outnumber ride requests.",
      insight: "Request with a fare estimate and ETA, nearby drivers ranked and offered one at a time with a 15-second window, a trip lifecycle with state-dependent cancellation fees, base-plus-distance-plus-time fares with surge, and notifications; one city and one process, with shared rides, routing internals and payment integration out. A driver is never offered or assigned two trips, a match completes well under a second, an unanswered offer never leaves a trip stuck, and location updates stay cheap.",
    },
    {
      prompt: "List the entities. Which object should every edge case be a question about, and where should a driver's availability live?",
      hint: "Find the one object that lives through the whole flow. Separately, picture two requests ranking the same driver in the same millisecond, and ask whose state they are fighting over.",
      insight: "Rider, Driver, Vehicle, Location and Trip, plus a DriverLocationIndex, MatchingStrategy, PricingStrategy, CancellationPolicy, listeners and a TripService facade. The Trip is the aggregate every edge case concerns; the driver's status is kept on the Driver, outside the trip, because it is the thing two trips fight over.",
    },
    {
      prompt: "Draw the trip's lifecycle, including where cancellation is legal. Would you use State classes, and how does the trip enforce its transitions against a double-tapped 'start trip'?",
      hint: "Count the states and events, and what differs per state beyond the allowed moves. Then think about which lock guards the state and what the method returns to its caller.",
      insight: "Requested, DriverAssigned, EnRoute, Started and Completed, with Cancelled reachable from the first three. An enum with canMoveTo is enough because per-state behaviour is a transition check and one fee rule; Trip.moveTo is synchronized, throws IllegalTransitionException so a double tap becomes a conflict response, and returns the event so listeners run after the lock is released.",
    },
    {
      prompt: "In what order do you claim a driver and send the offer? How do you guarantee that a 15-second timeout firing late never releases a driver who has just accepted?",
      hint: "If you ask first and claim later, two trips can ask the same driver. Model the driver's status as a few values and make every change conditional on the value you expect it to have.",
      insight: "Claim first, ask second: tryOffer is compareAndSet(Available, Offered), so one trip wins and the other moves to its next candidate, and the timeout is a one-shot job on the scheduler. Accepting does compareAndSet(Offered, OnTrip) and the timeout's releaseOffer does compareAndSet(Offered, Available), so a late timeout fails harmlessly; both also take the trip's monitor first, so only one of them sees the offer.",
    },
    {
      prompt: "Matching rules, fare formulas, surge, cancellation fees and notifications all vary independently. Which pattern fits each, and is surge better as a wrapper or as a parameter?",
      hint: "Some rules are swapped per city or per experiment; one multiplies whatever base rule is in force and may itself be wrapped by a promotion; several parties react to every transition without the service knowing who they are.",
      insight: "MatchingStrategy (a comparator over candidates), PricingStrategy and CancellationPolicy are Strategies; SurgePricing is a Decorator around the base PricingStrategy, with the multiplier captured on the trip at request time so the rider pays what they saw; TripEventListeners are Observers in a CopyOnWriteArrayList, each called in its own try. Surge as a parameter is simpler with one base formula; the decorator wins once airport flat rates or corporate tariffs exist.",
    },
    {
      prompt: "Name the shared mutable state and the tool for each. And the rider's app retries the request after a network blip: how do you avoid matching the same rider twice?",
      hint: "One piece is a single field contested by many; one is per-trip compound state; one structure is written tens of thousands of times a minute but is only ever a hint. For retries, think of a key the client generates.",
      insight: "Driver status is an AtomicReference changed only by compareAndSet; trip state is guarded by the trip's own monitor, one lock per trip, and the driver CAS inside it cannot block; the location index is a ConcurrentHashMap of grid cells whose staleness is harmless because tryOffer is the truth. A client-generated request key with trips.putIfAbsent hands the existing trip back to a retry.",
    },
  ],
  tradeoffs: [
    "Claim before offering vs offer then claim: choose claiming first because it rules out double offers and double assignment, accepting that a driver is unavailable for up to 15 seconds even if they decline late.",
    "Sequential offers vs offering to the top three at once: choose sequential offers when supply is sparse, because three claimed drivers may be every driver in range; choose broadcast when supply is dense, because matches are faster and tying up three of a thousand drivers costs nothing.",
    "CAS on driver status vs a ReentrantLock per driver taken with tryLock: choose CAS for a single field; choose the lock when a claim must update several fields together, and never block with lock() in the matching loop.",
    "Surge as a Decorator vs a parameter: choose the Decorator once more than one base rule exists, because it composes with any rule and with promotions; a parameter is simpler while there is one formula.",
  ],
  followUps: [
    "Offer the trip to three drivers at once. Where does the claim move, and what are your two choices for the drivers' status?",
    "Matching now runs on several machines. What becomes of tryOffer, the location index and the trip's monitor?",
    "No driver accepts within 3 km. What happens next?",
    "A driver's phone dies while their location is still in the index. How do you avoid offering them a trip?",
  ],
};
