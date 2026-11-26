import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-ticket-booking",
  title: "Design a ticket booking system",
  track: "hld",
  level: "intermediate",
  minutes: 40,
  scenario: "Design a ticket booking system like BookMyShow. Fans open a seat map, hold up to ten seats for ten minutes, pay through a payment provider and receive tickets. When an IPL final goes on sale, 200,000 fans arrive in the first minute for 5,000 seats, and no seat may ever be sold twice.",
  focus: "About 2,000 holds for 200,000 fans, and a seat map wanted 100k times a second that changes only about 50 times a second: cache the map, queue the people, and let the database decide each seat.",
  concepts: ["acid", "caching", "rate-limiting", "idempotency", "mvcc-isolation", "design-ecommerce"],
  steps: [
    {
      prompt: "Which guarantees matter for a seat, and where would you rather refuse a request than risk being wrong?",
      hint: "Think about a second ticket for one seat, a server that dies while a hold is open, a payment callback that arrives twice, and how stale the seat map may be.",
      insight: "No double booking, ever, so when correctness and availability conflict the hold is refused. Holds must expire reliably even if their server dies, confirm must be idempotent, the drop must not take down the database or other shows, and the seat map loads in under 200 ms but may be about a second stale.",
    },
    {
      prompt: "At the drop, how many holds can the inventory carry, how many fans want them, and what would the seat map and the database face if everyone were let in?",
      hint: "5,000 seats at 2.5 seats per hold. 200,000 fans refreshing the map every 2 s. Then work out an admission rate that matches the holds, with some allowance for abandoned ones.",
      insight: "Only 2,000 holds exist for 200,000 fans, so 99 attempts in 100 fail; letting everyone in means about 3,300 hold attempts a second under lock and about 100k seat-map reads a second. Behind a queue admitting about 50 fans a second, the database sees roughly 175 row writes a second, which any primary handles.",
    },
    {
      prompt: "Design the hold, pay and confirm endpoints and the tables. What is the one rule that no bug in your code can break?",
      hint: "Why might a hold answer before any money moves, and why might paying answer 'accepted' rather than 'done'? Which table's primary key could make a second booking of one seat impossible, whatever the code does?",
      insight: "POST /holds returns 201 with a hold_id and expiry, or 409 listing the taken seats; pay returns 202 because the provider decides when it is done; and confirm is idempotent on the payment id. The show_seat table has one row per seat per show with state, hold_id, hold_expires_at and a version, partitioned by show, and the booking_seat primary key (show_id, seat_id) is the backstop: a bug can create two holds but never two bookings.",
    },
    {
      prompt: "Two requests for seat E7 reach two servers in the same millisecond. How does the database make exactly one of them win, and which approach suits a drop?",
      hint: "Compare locking first, writing with a version condition, and inserting into a table with a partial unique index. Which wastes the least work when 99 attempts in 100 fail? How do you avoid deadlocks on multi-seat holds?",
      insight: "Lock the requested seats with SELECT … FOR UPDATE NOWAIT in seat_id order, check that each is free or its hold has expired, mark them HELD and insert the hold, all in one transaction. NOWAIT fails fast because the losing fan wants a different seat, and seat order prevents deadlocks; optimistic writes are cheaper on quiet days but turn into retry storms under contention. An expired hold counts as free the moment it is read, so correctness never waits for the sweeper.",
    },
    {
      prompt: "How do you turn 200,000 simultaneous fans into a line the inventory can absorb, and what happens if the queue itself fails?",
      hint: "Two counters per show are enough. How does an admitted fan prove it to the gateway? What should set the admission rate: your hardware, or something else?",
      insight: "Give each arrival a number from INCR on a per-show Redis counter, raise an admitted counter, and hand admitted fans a signed token for that user and show, which the gateway requires on POST /holds. Admissions per minute = free seats ÷ seats per hold × a margin for abandoned holds, recomputed from released and confirmed events, so the queue drains at the speed of payments; if Redis fails, the gateway falls back to a per-show rate limit.",
    },
    {
      prompt: "A fan pays at 12:09:59 for a hold that ends at 12:10. How do you avoid taking money for seats that are released, and how is a duplicate confirm handled?",
      hint: "Change the order of operations around payment: what should happen to the hold before you ask the provider? Should money be captured before or after the database confirms the booking?",
      insight: "Paying first extends the hold, say to 12:15, and only then authorises without capturing; confirm locks the hold, writes the booking and its seats, and capture happens only after that commit. A confirm for a released hold gets 409 and the authorisation is cancelled, a repeated confirm returns the same booking through the unique payment_id, and a reconciliation job asks the provider about holds stuck in PAYMENT_PENDING.",
    },
  ],
  tradeoffs: [
    "Seat rows with holds vs a counter per section: rows when the fan chooses a seat; a counter for general admission, accepting one hot row per section.",
    "Pessimistic NOWAIT locks vs optimistic version checks: pessimistic at a drop, because a refused lock costs one error; optimistic on normal days, because the uncontested case is one round trip.",
    "Redis vs the database as the owner of holds: the database, because a Redis failover could lose holds and sell E7 twice.",
    "Letting everyone in vs a waiting room: a waiting room, because 3,300 refusals a second under lock is itself the outage.",
  ],
  followUps: [
    "How do you stop bots from holding seats to keep them from real fans?",
    "Is first come, first served fair when 100,000 fans arrive within 10 seconds?",
    "What changes for a 50,000-seat stadium with two million fans in the first minute?",
    "During a database failover, what do fans see, and why is that the right failure?",
  ],
};
