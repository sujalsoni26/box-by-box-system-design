import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-movie-ticket-booking",
  title: "Design a movie ticket booking system",
  track: "lld",
  level: "intermediate",
  minutes: 35,
  scenario: "Users browse a city's shows, pick one to ten seats on a seat map, and have ten minutes to pay through an external gateway before the seats are released. Thousands may be choosing seats for the same Friday-night show at once. No seat may ever be sold twice, a hold must expire even if the server that created it dies, and confirming must be safe to retry.",
  focus: "Making the seat hold an all-or-nothing, expiring claim on per-show seat state, and building the booking lifecycle, idempotent payment and database locking around that one object.",
  concepts: ["design-patterns-behavioural", "concurrency-basics", "error-handling", "idempotency", "mvcc-isolation", "lld-library-management"],
  steps: [
    {
      prompt: "Which non-functional requirements drive this design more than the features do? When the system is unsure, should it favour availability or correctness?",
      hint: "Think about the worst outcome for a customer at the cinema, what happens to a payment page that is abandoned, and what users and payment callbacks do when they are not sure a click worked.",
      insight: "No double booking, ever, so correctness beats availability and the system refuses a hold when in doubt; holds expire reliably even if their server dies; and confirm is idempotent, because gateway callbacks are retried and users double-click. The seat map may be a few seconds stale, because the hold, not the map, is where truth is enforced.",
    },
    {
      prompt: "Where does a seat's availability live, and which object owns that state?",
      hint: "The same physical seat can be free for the 3 p.m. show and sold for the 9 p.m. one. You made a similar split in the library case study.",
      insight: "Seat is an immutable position in a screen; ShowSeat is its per-show state (free, held by whom until when, or booked), owned by the Show, and it is the only object a hold changes. A Booking refers to its ShowSeats rather than owning them, so a booking that expires leaves the seats intact.",
    },
    {
      prompt: "A user asks for E7, E8 and E9, and E8 is already held. What does the hold do? And how does a hold expire if no background job has run yet?",
      hint: "Partial success leaves a group split across the hall. For expiry, ask who looks at the seat next and whether they could decide for themselves that the hold is over.",
      insight: "The hold is all-or-nothing: refuse all three and say which seat failed, because the user's next action depends on it. Expiry is decided at read time, where isAvailable treats a hold whose time has passed as free, so correctness never depends on the sweeper being punctual; the sweeper only tidies up.",
    },
    {
      prompt: "Draw the booking's lifecycle from hold to ticket, with every exit. Where could a crash leave a customer with money taken but no ticket, and how does your state machine make that visible? State classes or something lighter?",
      hint: "Walk the pay call step by step: extend the hold, charge, mark the seats booked. A crash can land between any two of those steps.",
      insight: "Held, PaymentPending, Paid and Confirmed, with Expired and Cancelled as exits, kept as an enum with a transition table because the behaviour per state is tiny. Paid and Confirmed are separate on purpose: a crash between the charge and marking the seats BOOKED leaves a Paid booking that a recovery job can find and complete, or refund if the hold lapsed and the seats were resold.",
    },
    {
      prompt: "The gateway retries its callback and the user double-clicks Pay. Meanwhile the hold could lapse while the gateway is still deciding. How does pay stay safe against both?",
      hint: "These are two separate threats: charging twice, and charging for a seat that is resold mid-payment. What can pay check and change before it calls the gateway, and what key can it send with the charge?",
      insight: "The pay method returns an already Confirmed booking unchanged, checks that the hold is still valid before charging and extends it by a grace period so it cannot lapse mid-payment, then charges with 'booking-' plus the booking id as the gateway's idempotency key. A retry therefore replays the first charge instead of making a second one.",
    },
    {
      prompt: "Two requests read E7 as free and both try to hold it. Fix this in one process, then across several servers sharing a relational database. When would you pick each database approach?",
      hint: "In one process, ask how coarse the lock should be. Across servers the lock must live where the data lives: either detect a conflicting write after the fact, or lock the rows before deciding, and watch the order in which rows are locked.",
      insight: "In one process, a ReentrantLock per show (created with computeIfAbsent) around check-all-then-mark-all, so one blockbuster does not slow the show next door. Across servers, either optimistic, a conditional UPDATE with a version column where zero rows updated means someone moved first, best when most seats are uncontested; or pessimistic, SELECT FOR UPDATE NOWAIT in ascending seat order to avoid deadlock, better for the last seats of a sold-out show. Either way, a unique constraint on booked (show, seat) is the backstop no bug can get past.",
    },
  ],
  tradeoffs: [
    "Optimistic version column vs pessimistic row lock: choose optimistic for the common, uncontested case with no locks on the hot path; choose FOR UPDATE NOWAIT for the last seats of a sold-out show, where retries would thrash.",
    "Read-time expiry plus a sweeper vs relying on the sweeper: choose read-time expiry so correctness does not depend on job timing, accepting two places that must agree on the rule.",
    "A 10-minute hold vs a shorter one: choose 10 minutes because buyers need time to pay, accepting that inventory stays off the market while carts are abandoned.",
    "Database as the lock vs a Redis key with a time to live: choose the database for one source of truth that survives crashes; SET NX EX is fast for the 'is it held?' check but needs a script for multi-seat holds and loses holds if a single node fails.",
  ],
  followUps: [
    "The process crashes after the gateway captured the money but before the seats were booked. What does the recovery job do if the hold has lapsed and a seat was resold?",
    "Couple seats must sell as one unit. What changes in the inventory?",
    "Implement the hold as a Redis key with a time to live. What do you gain and what do you lose?",
    "Where would weekend and premium pricing plug in?",
  ],
};
