import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 16: Low-Level Design: Case Studies, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Low-Level Design: Case Studies
  "lld-parking-lot": {
    breaks: "Without one owner of spot state and an atomic claim, two gates can issue tickets for the same bay, and pricing rules hard-coded into the lot change every time finance changes its mind.",
    tradeoffs: "Two Strategy interfaces and a per-spot atomic flag add classes, make 'nearest free spot' best-effort under contention, and the in-memory design must move to a database once gates span machines.",
    explainSimply: "Picture a car park where every bay has a light that turns red the instant a car is sent to it. Gate staff pick from the green bays, and the light switches so fast that two gates can never pick the same one. How bays are chosen and how much you pay are separate rule books that can be rewritten without touching the bays.",
    hint: "Separate what the lot has from what the lot decides, then ask at which exact moment a spot stops being free.",
  },
  "lld-vending-machine": {
    breaks: "A machine whose insert, select and cancel methods each switch on a status field scatters one state's rules across the class, so a new state or a failed dispense edits every method and one missed branch gives away stock or swallows money.",
    tradeoffs: "One class per state and an explicit transaction object are more files than an enum and a switch, and holding the machine's lock through a slow dispense keeps the keypad busy until the item drops.",
    explainSimply: "A good shopkeeper behaves differently depending on where you are in the sale: before you have paid, after you have paid, while they fetch the item. Here each of those moods is its own little rule book, and the till and the shelf stay the same whichever rule book is open. The shopkeeper also checks the change drawer before handing anything over.",
    hint: "One class per state, then ask which object must remember the money when the state changes.",
  },
  "lld-elevator": {
    breaks: "A controller that serves the nearest request first starves far floors under steady traffic, and one that mixes dispatch, stop ordering and safety checks in a single loop cannot change any of them without risking the others.",
    tradeoffs: "Two strategy interfaces, a mode guard and a lock per car add indirection, LOOK saves travel but makes waits less predictable than SCAN, and a discrete tick model hides acceleration and door timing.",
    explainSimply: "A lift that always went to whoever is closest would leave the person on the top floor waiting while people on the middle floors kept pressing buttons. So a lift keeps going in one direction, stopping for everyone on the way, and turns round only when nobody further along is waiting. Deciding which lift answers a button, where that lift stops next, and whether it is safe to move are three separate jobs.",
    hint: "Three decisions, three objects: who answers the call, where the car stops next, and whether it may move at all.",
  },
  "lld-library-management": {
    breaks: "With one Book object carrying a status, three copies of the same title cannot be told apart, so a reservation cannot queue for 'any copy', a lost copy takes the whole title with it, and two desks can lend the same barcode twice.",
    tradeoffs: "Two objects where most people draw one means an available-count per title for search results, a copy status that is a cache of loans and holds and must change in step with them, and extra classes for per-tier policies and listeners.",
    explainSimply: "A library has one catalogue entry for a book and several physical copies of it on the shelf. You queue for the title, but you borrow, return, lose and pay fines for one particular copy. Keeping those two ideas apart is what makes 'all copies are out, add me to the queue' possible to say at all.",
    hint: "Ask what a member waits for, and what a member actually carries home.",
  },
  "lld-movie-ticket-booking": {
    breaks: "Without an atomic, expiring hold two buyers pay for one seat or abandoned carts keep seats unsellable, and a retried payment callback books or charges twice.",
    tradeoffs: "A hold takes inventory off the market for its TTL, every anti-double-booking mechanism costs a lock or a retry, and the state machine and idempotency keys add bookkeeping to every write.",
    explainSimply: "It works like putting your hand on the last box of sweets at a counter: while your hand is there nobody else can take it, but if you have not paid within ten minutes the shopkeeper lifts your hand off. Your name goes on the receipt, so paying twice by mistake still buys the box once.",
    hint: "Think about what must stay true of a seat between the moment a user picks it and the moment the payment arrives, and who enforces it.",
  },
  "lld-splitwise": {
    breaks: "Without an exact, validated split and an immutable ledger, balances drift by paise, edits corrupt history, and a group ends up making far more payments than it needs.",
    tradeoffs: "Integer paise and strict validation reject inputs a casual user expects to work, and simplification is either a fast greedy pass that may use more transfers than necessary or an exact search that explodes with group size.",
    explainSimply: "Think of a shared trip notebook where every page is a receipt that can never be erased, only cancelled by a new page. At the end you add up each person's pages to get one number, and the person who is owed most is paid by the person who owes most until everyone is at zero.",
    hint: "Ask what the shares of one expense must add up to, and which unit makes that check exact.",
  },
  "lld-snake-and-ladder": {
    breaks: "Without a dice abstraction and a validated board, the game cannot be tested deterministically, impossible boards make games unwinnable, and each rule variant adds a conditional to the loop.",
    tradeoffs: "Every abstraction is one more class in a small program; the interface for dice and the builder for the board pay off only because tests and configuration need them.",
    explainSimply: "The board is a numbered path, snakes and ladders are shortcuts down or up, and the dice decide how far you go. The trick is to let a tester hand the game a loaded die so every move can be checked, and to inspect the board before the game starts so nobody can be stuck forever.",
    hint: "Ask what in the game is random, and who should be able to replace it.",
  },
  "lld-chess": {
    breaks: "If each piece decides its own legality, pins, discovered checks and castling through check become special cases scattered across six classes, and undo cannot restore a captured piece or a lost castling right.",
    tradeoffs: "Simulating every candidate move costs two board edits per candidate, fine for human play and too slow for an engine, and the board must save and restore three extra position facts on every move.",
    explainSimply: "Each piece only knows the shapes it can move in, like a dancer who knows the steps but not the stage. The board checks each proposed move by trying it, looking whether the king is in danger, and putting everything back. Every accepted move is written on a list with enough detail to undo it.",
    hint: "Ask which question belongs to the piece and which belongs to the board, then ask what one move destroys that undo must bring back.",
  },
  "lld-in-memory-cache": {
    breaks: "A map with a size limit but no order must scan to find the least recently used entry, expired values are served until something notices, and a hot key that expires sends every missing thread to the database at once.",
    tradeoffs: "Links inside the entry make it mutable and couple it to the policy, lazy expiry lets size briefly count stale entries, and because an LRU read is a write, concurrency costs either one lock or an approximate eviction order.",
    explainSimply: "Think of papers on a desk: whatever you touch goes on top, and when the desk is full the bottom sheet is archived. An index card tells you instantly where each paper is, and every sheet knows its two neighbours so pulling one out of the middle is a single tug. A timer throws away sheets that have gone stale even if nobody touches them.",
    hint: "Ask what structure answers where is it and what structure answers who leaves next, then ask how a hit updates the second one without searching.",
  },
  "lld-logging-framework": {
    breaks: "A logger that formats, filters and writes in one method pays for debug messages nobody reads, lets a broken file appender throw into business code, and makes every request wait for the slowest destination.",
    tradeoffs: "Four small interfaces and a registry add classes, the bounded async queue means some INFO lines are dropped under overload by design, and events still in the queue at shutdown are lost unless the context is stopped cleanly.",
    explainSimply: "Think of a newsroom: reporters drop dispatches in a basket and go back to work, an editor's threshold decides what is worth printing, and each outlet prints the story in its own style. The basket has a fixed size, so the rule for a full basket, make reporters wait or bin the gossip, is agreed in advance.",
    hint: "Name the four questions a log call answers, then ask which one must be answered before anything is allocated.",
  },
  "lld-rate-limiter": {
    breaks: "A limiter that tops up buckets with a scheduled task pays per key rather than per request, one that reads and writes its counter in two steps double-spends under concurrent threads, and one that uses wall-clock time grants a free refill after every clock correction.",
    tradeoffs: "Two interfaces where a naive design has one class, elapsed-time arithmetic on every call, a per-bucket lock that serialises a single hot key's callers, and a monotonic clock that is not comparable across processes, which is fine until the limiter must be shared.",
    explainSimply: "Think of a travel card that earns one ride a minute up to ten saved rides. The card does not tick in your pocket: when you tap in, the reader works out how many rides accrued since your last tap and adds them before deciding. Each client has its own card, and cards nobody has tapped for a while are thrown away.",
    hint: "Ask when the refill arithmetic runs, where each client's state lives, and what makes refill-and-spend a single step.",
  },
  "lld-task-scheduler": {
    breaks: "Without one owner of 'what runs next' and a next-run time computed after the run, a slow task is started again on top of itself, a thrown exception ends a recurring job for good, and cancellation races the dispatcher.",
    tradeoffs: "A single dispatcher thread, a DelayQueue and a semaphore of worker permits add moving parts, serialise dispatch, give no priority among jobs due at the same instant, and must move to a shared store with a conditional claim once the scheduler spans machines.",
    explainSimply: "Think of a clinic's appointment book sorted by time. One receptionist calls the next patient only when their time has come and a room is free, a doctor who runs late pushes later patients back but never puts two in one room, and a no-show is rebooked with growing gaps a few times before being struck off. The book, the receptionist and the rooms are three separate things.",
    hint: "Ask who is allowed to touch the queue, and at which moment the next run time is computed.",
  },
  "lld-ride-booking": {
    breaks: "Without an atomic claim on the driver and a single owner of the trip's state, two trips are assigned one driver, a late offer timeout releases a driver who just accepted, and fee and surge rules get hard-coded into the trip.",
    tradeoffs: "Claiming before offering makes a driver unavailable for the whole offer window, sequential offers slow the match when drivers decline, and the in-memory claim and index must move to a shared store once matching spans machines.",
    explainSimply: "Think of a taxi-rank dispatcher with a whiteboard: a magnet beside each driver says free, offered or on a job, and the dispatcher moves the magnet before picking up the radio. Two dispatchers can never radio the same driver, because only one of them finds the magnet on free. The ride itself moves through a fixed set of stages, and what cancelling costs depends on the stage.",
    hint: "Ask at which exact moment a driver stops being available, and who is allowed to move the trip from one stage to the next.",
  },
  "lld-food-ordering": {
    breaks: "Without a frozen snapshot, one idempotency key per checkout and named compensations, a placed order's total drifts with the menu, a retried charge takes the money twice, and a rejection after payment leaves the customer unpaid because there is nothing to roll back.",
    tradeoffs: "Re-reading the menu at checkout adds a confirmation step, paying before placement turns every rejection into a refund, and modelling refunds as retried jobs means a failed refund is something to monitor rather than an exception to catch.",
    explainSimply: "A waiter writes your order on a pad and the kitchen cooks from the pad, never from the menu board, so a price change at the door cannot change your bill. If the kitchen runs out of a dish after the ticket is in, the waiter strikes it off and gives the money back rather than pretending the ticket never existed. The pad is the order; the strike-through is the refund.",
    hint: "Ask what the cart stores, when the price becomes final, and what happens to money that has already moved when a later step says no.",
  },
  "lld-revision": {
    breaks: "Without retrieval practice the patterns stay as vocabulary: you can define Strategy and State but reach for an if-chain the moment a real class is on the whiteboard.",
    tradeoffs: "Redoing a case study from a blank page takes half an hour and feels worse than rereading it in five minutes, and the cards you miss keep coming back; that effort is what moves the pattern from recognition to use.",
    explainSimply: "This page is a deck of cards. Each one describes a coding problem, and you say which design idea solves it before turning the card over. Then, once a week, redo one of the fourteen problems without looking and compare your drawing with the lesson's.",
    hint: "Think about where the rules for one status live now, and where they would live if each status were a class.",
  },
};
