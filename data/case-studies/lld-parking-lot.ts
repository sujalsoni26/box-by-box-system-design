import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-parking-lot",
  title: "Design a parking lot",
  track: "lld",
  level: "intermediate",
  minutes: 35,
  scenario: "A multi-storey car park has five floors of 200 spots in three sizes, with four entry and four exit gates working at the same time. Design the code inside the lot: issue a ticket and a spot at entry, charge by duration and spot size at exit, and settle a lost ticket. A gate decision should take milliseconds, and a spot must never go to two cars.",
  focus: "Keeping the entities (floors, spots, tickets) apart from the two decisions that change with the business (which spot, what price), and making the spot claim one atomic step so concurrent gates never share a bay.",
  concepts: ["class-relationships-uml", "solid", "interfaces-abstractions-di", "design-patterns-behavioural", "design-patterns-structural", "concurrency-basics"],
  steps: [
    {
      prompt: "Before you draw a class, what do you put in scope and what do you leave out? Which assumptions would you state as numbers?",
      hint: "Most failed attempts design features no car needs on day one. Start from the two things a driver actually does, then ask which tempting features involve the future, a second lot or electricity.",
      insight: "In scope: floors of sized spots where a vehicle may take the next size up, a ticket at entry, payment by duration and size at a kiosk or the exit, a free-spot display per floor and a flat fee for a lost ticket. Reservations, electric charging, valet, shared capacity across lots and the payment provider's integration are out. Stating 5 floors of 200 spots, 4 entry and 4 exit gates and one lot per deployment tells the interviewer that one process can own the lot's state.",
    },
    {
      prompt: "List the entities and give each a one-sentence responsibility. Which single object is touched by both the park and the exit use case, and what does that imply about how you model it?",
      hint: "Underline the nouns in the requirements. For each, ask which stakeholder changes it: operations, finance, the gate hardware vendor, or the physical lot itself.",
      insight: "ParkingLot is a facade for park and exit; ParkingFloor holds spots; ParkingSpot is one bay with a size and an occupancy flag; Vehicle, Ticket and the two gate classes sit alongside SpotAllocationStrategy, PricingStrategy and PaymentProcessor. The Ticket is a full entity rather than an id because entry creates it, the kiosk changes it and exit closes it, so every edge case becomes a question about its state.",
    },
    {
      prompt: "Motorcycle, car and truck: a class hierarchy or something lighter? And which relationships are ownership and which are mere reference, for example lot to floor and ticket to spot?",
      hint: "Ask what actually differs between a motorcycle and a truck in this problem. For relationships, apply the lifetime test: delete the whole, and see whether the parts survive.",
      insight: "Vehicle types are an enum, because they differ in one datum, the smallest spot size they fit, and three empty subclasses would be ceremony. The lot composes its floors and each floor composes its spots, since neither means anything outside its parent; a ticket only refers to a vehicle and a spot that exist whether or not it does.",
    },
    {
      prompt: "Operations wants a 'fill upper floors first' rule next month and finance is adding weekend rates. Where do those decisions live so that neither change edits ParkingLot or ParkingSpot? Which patterns would you deliberately not use?",
      hint: "Two things vary independently of the entities. Then test the usual reflexes against the facts: there is one lot, the display only shows counts, and a ticket has four required fields and no optional ones.",
      insight: "Spot allocation and pricing are two Strategy interfaces injected into the ParkingLot facade, so a new allocation rule or a weekend flat rate is a new class. The lot is not a Singleton (one instance is created at start-up and handed to the gates), the display is not an Observer (it reads per-floor counters), and Ticket needs no Builder; saying those absences aloud earns credit.",
    },
    {
      prompt: "At the exit gate the driver's card is declined. What state are the ticket and the spot in afterwards? And what does a driver owe who paid at the kiosk but then sat in the exit queue for twenty minutes?",
      hint: "Draw the ticket's lifecycle first; one of its arrows goes backwards. For the declined card, look at the order of the writes in exit relative to the charge.",
      insight: "The exit method throws before touching the ticket or the spot, because every write happens after the charge succeeds, so the spot stays occupied, the ticket stays Issued and the driver can try another method. The ticket goes Issued, Paid, Closed, with Paid back to Issued when the grace window is missed and Lost as its own state; the exit charges price minus amountPaid, which is zero inside the window and the overrun after it.",
    },
    {
      prompt: "Two entry gates search at the same instant and both see spot F2-041 free. Where exactly is the race, what is the cheapest correct fix, and which tempting fixes would you reject?",
      hint: "Name the shared mutable state first. Then look at the gap between finding a free spot and marking it taken, and ask which tool turns a check-then-act on a single boolean into one step.",
      insight: "The race is the gap between finding and claiming, so the allocation strategy claims while it searches: tryOccupy is compareAndSet(false, true) on the spot's AtomicBoolean, exactly one gate sees true and the loser's loop moves on. A ReentrantLock per floor held for the search is also defensible and finds the truly nearest spot; one lock for the whole lot makes eight gates take turns, and volatile fixes visibility but leaves the check-then-act gap open.",
    },
  ],
  tradeoffs: [
    "Compare-and-set per spot vs a lock per floor: choose compare-and-set when gates should never wait for each other, accepting that 'nearest' is best-effort under contention; choose the floor lock when the truly nearest spot matters, at the cost of serialising gates on one floor.",
    "Enum vs class hierarchy for vehicle types: choose the enum because the types differ in one datum; a hierarchy earns its place only when behaviour per type appears.",
    "A strategy that claims vs a strategy that only finds: choose claiming inside the search because it closes the check-then-act gap, accepting that the strategy is no longer a pure query.",
    "State in one process vs a shared database: choose one process while one lot runs on one machine; gates on several machines need the spot table in a database and a conditional update as the claim.",
  ],
  followUps: [
    "The gates now run on separate machines. What replaces the AtomicBoolean, and how does a gate know its claim failed?",
    "How would you add reservations without changing the allocation loop?",
    "A driver reports the ticket lost. Walk through the states, and say what happens if the 'lost' ticket turns up at the exit later.",
    "How would you keep the last few large spots free for trucks?",
  ],
};
