import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 13: Architecture Patterns, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Architecture Patterns
  "modular-monolith-soa": {
    breaks: "Without enforced module boundaries every feature reaches into every table, so a change anywhere breaks tests everywhere and the monolith can never be split except by rewriting it.",
    tradeoffs: "Hard boundaries cost indirection and duplicated data inside one process, and a premature split into services adds network failures and operations overhead without buying any independence.",
    explainSimply: "Think of a department store under one roof: shoes, groceries and electronics each keep their own stock and tills, and a shopper walks between them through the aisles. The store does not need to become three separate shops until the queues or the deliveries demand it. A modular monolith is that store; the departments are bounded contexts.",
    hint: "Think about the word 'order' as three different teams would define it, and where the definitions change.",
  },
  "api-gateway": {
    breaks: "Without a gateway each service terminates TLS, validates tokens and rate-limits on its own, clients must know every service address, and a phone pays several round trips per screen.",
    tradeoffs: "The gateway is an extra hop on every request and a single component in front of everything, so it must be stateless and replicated, its timeouts and limits must agree with the backends, and it must be kept free of business logic.",
    explainSimply: "An API gateway is like the reception desk of a large office: it checks your badge, keeps the queue orderly and points you to the right floor, but it does not do the work of any department. A backend-for-frontend is a separate desk for a particular kind of visitor, run by the people who know what that visitor needs.",
    hint: "List the things that are true of every request regardless of what it is for, then notice that business rules are not on the list.",
  },
  "service-mesh": {
    breaks: "Without a mesh, encryption, retry and timeout behaviour is reimplemented in every language and drifts, so one team's aggressive retries and another's missing timeouts combine into cascading failures that nobody can see end to end.",
    tradeoffs: "Every service-to-service call now passes through two proxies, every pod carries a proxy's memory, and a control plane must be run, upgraded and debugged alongside the applications.",
    explainSimply: "Instead of teaching every employee to check IDs, keep records and redial dropped calls, the building puts a trained receptionist at every office door and runs them all from one head office. The employees just do their jobs. The price is a desk at every door and a slightly longer walk for each visit.",
    hint: "List what every service used to do about the network itself, then ask where that work went and what the new component in the path costs.",
  },
  "cqrs": {
    breaks: "Without the split, the same normalised model serves a hot read path with five-table joins and a write path with complex rules, so one grows denormalised copies that break the rules and the other slows every screen.",
    tradeoffs: "Two models mean two codebases to keep in step, projections that lag the write side, and a UI that must cope with not seeing its own write for a moment; applied outside a complex bounded context, that complexity buys nothing.",
    explainSimply: "A restaurant kitchen decides which orders are allowed and cooks them; the boards in the dining room show what is ready, each updated from the kitchen a few seconds behind. Guests read the boards, never the pans. CQRS keeps the deciding and the showing in separate places.",
    hint: "Think about who is allowed to change the data and who only looks at it, and what happens in the gap between a change and the board being updated.",
  },
  "event-sourcing": {
    breaks: "Overwriting rows destroys the history, so audits, 'what did the user see at the time' questions and bug reconstruction become guesswork, and a new report over old data cannot be built because the data no longer exists.",
    tradeoffs: "Events are forever, so every schema change needs versioning or upcasting, erasure requests collide with immutability, reads from projections lag the writes, and set-based queries need a projection before they can be answered.",
    explainSimply: "A bank does not store your balance and scribble over it; it keeps every statement line and works the balance out from them. A mistake is fixed by adding a reversal line, never by editing the past. Event sourcing runs a system the way a bank runs a statement.",
    hint: "Think about how a bank statement gets to a balance, how it corrects a mistake, and why the opening balance at the top saves time.",
  },
  "strangler-fig": {
    breaks: "Without an incremental path a replacement is a multi-year rewrite with a frozen roadmap and a single cut-over, and any attempt to run old and new side by side with dual writes leaves the two databases silently disagreeing.",
    tradeoffs: "Running two systems at once costs a facade, duplicated infrastructure, synchronisation plumbing and a growing pile of flags, all of which must be removed at the end or they become the next legacy system.",
    explainSimply: "Renovate a shop while it keeps trading: fence off one aisle, fit the new one behind the fence, open it, move the stock, take the old aisle down, move the fence. Customers never see a closed shop. The fence is the facade and moving the stock is the data migration.",
    hint: "Think about what sits in front of both systems, what decides which one answers, and who is allowed to write the data at any moment.",
  },
  "serverless": {
    breaks: "Without a per-use platform, bursty or rare workloads need servers provisioned for the peak and paid for at idle, and someone must patch, scale and monitor them.",
    tradeoffs: "Functions are stateless, short-lived and limited in payload and runtime, the first request after idleness pays a cold start, local testing is approximate, the provider's event formats lock you in, and at steady high load per-use pricing costs more than always-on servers.",
    explainSimply: "Taking taxis instead of owning a car: you pay only while riding, never park or service anything, and it is perfect for occasional trips. Sometimes you wait for the taxi to arrive, and if you ride every day it ends up dearer than a car. Serverless is taxis for compute.",
    hint: "Think about what happens to the taxi analogy when the first ride of the day is requested, and what it costs to have one waiting outside.",
  },
  "multi-tenancy": {
    breaks: "In a pool with no per-tenant limits one tenant's load degrades everyone, and a tenant id taken from the URL instead of the token lets any customer read another's rows.",
    tradeoffs: "Dedicated databases and cells multiply migrations, connection pools and idle cost, while pooling demands row-level enforcement, per-tenant limits and metering to know who costs what.",
    explainSimply: "A block of flats shares one building and one boiler, with a meter in each flat and a rule about late parties: that is pooling small customers. A detached house has its own boiler and its own bill: that is a dedicated database for a big or regulated customer. The building manager keeps the list of who lives where.",
    hint: "Think about which two kinds of tenant justify their own building, and what everyone else gets instead.",
  },
  "advanced-revision": {
    breaks: "Without recall practice you recognise every advanced block on the page and still freeze when an interviewer describes the problem and waits, because reading built recognition, not retrieval.",
    tradeoffs: "Flashcards are slower and less comfortable than rereading, and the cards you miss keep returning until you know them; that discomfort is the mechanism.",
    explainSimply: "This page is a deck of cards. Each one describes something going wrong in a big system, and you say which tool fixes it before turning the card over. The table below the deck shows every answer with the lesson it came from.",
    hint: "Think about what a new leader needs that an old one cannot forge.",
  },
};
