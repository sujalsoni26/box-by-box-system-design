import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-payment-system",
  title: "Design a payment system",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design the payment service that an order system calls to charge customers through a payment service provider (PSP). It supports cards and UPI, authorise-then-capture, refunds and provider webhooks. Assume 1M payments a day averaging ₹1,500, a sale day at ten times the average, and a PSP that sometimes times out after the money has already moved.",
  focus: "Ten payments a second is nothing; about ₹9 lakh a minute of 'did it go through?' during PSP ambiguity is everything. The design keeps one correct record of money across three parties that never share a transaction.",
  concepts: ["acid", "timeouts-retries", "idempotency", "delivery-semantics", "distributed-transactions", "sagas", "design-ecommerce"],
  steps: [
    {
      prompt: "What does the payment service do, what is it not, and what should it say when it does not yet know whether a charge succeeded?",
      hint: "Separate your service from the PSP. Think about double charges, audits years later, card numbers, and the difference between 'failed' and 'unknown'.",
      insight: "Create payments with a tokenised method, authorise now and capture later, refund, report status, keep a ledger, receive webhooks and reconcile daily; being the PSP, fraud scoring and merchant payouts are out. Money is conserved and every change is traceable for years, authorisation takes under 2 s, card numbers never reach our servers, and the service degrades to pending, never to failed, because 'we do not know yet' is the truth.",
    },
    {
      prompt: "Estimate payments per second, PSP calls in flight, ledger growth and the money at stake while the PSP is ambiguous. Which number actually drives the design?",
      hint: "1M payments a day is about 10 a second. Apply Little's law with the PSP's 0.5 s median and 2 s p99, then multiply one minute of payments by ₹1,500.",
      insight: "About 10 payments a second (100 on a sale day), roughly 100 concurrent PSP calls and about 1.1 TB of ledger a year: nothing strains a database. The driver is about ₹9 lakh a minute whose outcome may be unknown, so the design is about one correct record of money across three parties, a stream that must be a ledger rather than a log.",
    },
    {
      prompt: "Which tables let a crash mid-call leave evidence, make a duplicate webhook harmless and explain every rupee? How should a payment's status change safely?",
      hint: "Think about a row per PSP call whose outcome can be unknown, a primary key on the PSP's event id, and a record of money that is never updated. What should happen when events arrive twice or out of order?",
      insight: "Keep payment (unique order_id, versioned status), payment_attempt (one row per PSP call with its own idempotency key and a NULL outcome while unknown), the callers' idempotency keys, psp_event keyed by the PSP's event id, and an append-only double-entry ledger whose journals sum to zero. Status moves through CREATED, AUTHORISING, AUTHORISED, CAPTURE_PENDING and CAPTURED by version-checked conditional updates, so a repeated or early event applies once or changes nothing.",
    },
    {
      prompt: "The authorise call times out and you cannot tell whether the PSP charged the customer. What do you do, step by step?",
      hint: "What must be written before the call? Which key does the retry use? What happens when the retry budget runs out, and when, if ever, may you mint a new key?",
      insight: "Record the attempt with its own key and a NULL outcome and commit before calling the PSP, so a crash leaves proof that the call may have happened. Retry with the same key, which makes the PSP replay its first answer, and when the budget is spent leave the payment in AUTHORISING for a reconciler or the webhook to resolve while the PSP still remembers the key. Never mint a second key for the same intent, because a new key is a new charge.",
    },
    {
      prompt: "How do you record a ₹1,200 capture, the PSP's fee, the settlement and a refund so the money can be proven, and how do you catch whatever idempotency missed?",
      hint: "Every movement leaves one account and enters another. What should a mistake look like in a record nobody may edit? What does the PSP send you every day?",
      insight: "Use a double-entry ledger in which each journal debits one account and credits another and sums to zero (a capture debits psp_clearing and credits merchant_payable), and fix mistakes with a correcting journal, never an edit. A daily job matches the PSP's settlement report to journals by psp_ref and sorts the leftovers into breaks: at the PSP only, in our ledger only, or amounts that differ; psp_clearing for settled payments must sum to zero.",
    },
    {
      prompt: "How do the order and payment services coordinate without a distributed transaction, and how should webhooks be received?",
      hint: "Which step is the point of no return? Should money be taken before fulfilment is certain? What must a webhook receiver check first, and how fast should it answer?",
      insight: "Order and payment form a saga with authorisation as the pivot: authorise, confirm the order, then capture, with voiding the authorisation as the compensation, which is why authorise-then-capture suits fulfilment that can fail. The webhook receiver verifies the HMAC signature and timestamp, records the event id, answers 200 at once and queues the work; status, attempt outcome and ledger journal then commit in one transaction, and an outbox tells the order service.",
    },
  ],
  tradeoffs: [
    "Authorise then capture vs capture immediately: authorise first when fulfilment can fail after payment, because cancelling an authorisation releases the funds without a refund; capture at once when it cannot.",
    "Exactly-once vs idempotent retries plus reconciliation: exactly-once does not exist across a PSP, so make every call idempotent on both ends and reconcile daily.",
    "A mutable balance column vs a snapshot plus the sum of entries: snapshot plus sum, because a mutable balance is a hot row and throws history away.",
    "Idempotency keys in Redis vs in the payment's own transaction: in the same database transaction, because a crash between two stores is a double charge or a lost one.",
  ],
  followUps: [
    "A webhook arrives before the synchronous response, or a capture event arrives before the authorisation. What happens?",
    "How do you verify that a webhook is genuine and not a replay?",
    "On a sale day the PSP starts rate-limiting you. What changes?",
    "At 100×, what becomes of the ledger?",
  ],
};
