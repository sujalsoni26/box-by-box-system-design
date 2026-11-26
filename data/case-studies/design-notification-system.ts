import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-notification-system",
  title: "Design a notification system",
  track: "hld",
  level: "intermediate",
  minutes: 40,
  scenario: "Design a service that turns events such as 'order shipped' or 'OTP requested' into push notifications, SMS and emails sent through providers like APNs, FCM and SMS gateways. It sends 10M notifications a day, a marketing campaign can spike arrivals a hundredfold, and users set channel preferences and quiet hours.",
  focus: "The mismatch between 10k notifications a second arriving during a campaign and the fixed rate each provider accepts (for example 500 SMS a second). The design is durable queues, priority lanes and paced workers; storage is easy.",
  concepts: ["message-queues", "pubsub", "idempotency", "timeouts-retries", "circuit-breaker", "bulkheads-degradation", "delivery-semantics"],
  steps: [
    {
      prompt: "Which channels, priorities and user controls must the system support, and which two failures would hurt users most?",
      hint: "Picture a user waiting for an OTP while a coupon campaign is going out, and a user who opted out of marketing yesterday. What must never happen to either of them?",
      insight: "Push, SMS and email with templates, preferences, quiet hours, deduplication, per-user caps, scheduling and delivery tracking, and two priorities: transactional and marketing. Nothing may be lost or sent twice, a campaign must never delay an OTP, transactional latency is a few seconds, and preferences are law, because a message after an opt-out is a legal problem rather than a bug.",
    },
    {
      prompt: "At 10M a day with a 100× campaign spike, 10% of traffic on SMS and an SMS provider that accepts 500 a second, what happens during the spike, and how many provider calls are in flight?",
      hint: "Compute arrivals per second at the spike, compare the SMS share with what the provider accepts, and apply Little's law with about 300 ms per provider call.",
      insight: "The spike is 10k/s, so SMS arrives at 1k/s against 500/s accepted: a 10-minute campaign builds 600k texts that take 20 minutes to drain, with about 3,000 calls in flight overall. Storage is easy; the dominant number is the gap between arrival rate and fixed provider rates, so the design is durable queues to absorb, lanes to reorder and workers sized by Little's law.",
    },
    {
      prompt: "What should POST /v1/notifications return, and which tables and keys stop a retried call or a redelivered event from producing a second message?",
      hint: "Is the work done when the API answers? Think about where a caller-supplied key and a 'one delivery per channel' rule could be enforced by the database itself.",
      insight: "Return 202 Accepted, because the request is durable but not yet delivered. A notifications table carries the caller's idempotency_key as UNIQUE, and a deliveries table has one row per channel with UNIQUE (notification_id, channel), a status, attempts, a claimed_at lease and the provider's message id that webhooks use to find their row; preferences and device tokens sit behind a cache.",
    },
    {
      prompt: "Queues redeliver messages and a provider cannot un-send one. How do you get as close as possible to sending each notification exactly once?",
      hint: "Exactly-once end to end is impossible. Look for one guard at the API, one at ingestion and one immediately before the provider call. What window remains if a worker crashes just after the provider accepted?",
      insight: "Three guards: the unique idempotency key at the API, Redis SET NX with a 24-hour TTL at ingestion, and a conditional UPDATE that claims the delivery row (queued to sending) before the provider call. For the remaining crash window, resend transactional messages once the lease expires and drop marketing ones, using APNs collapse ids or FCM collapse keys to make a resend harmless; SQS FIFO and Kafka transactions do not reach across the HTTP call to a provider.",
    },
    {
      prompt: "A campaign has filled the SMS queue with 20 minutes of coupons. How do you still get an OTP out within seconds?",
      hint: "Neither Kafka nor SQS reorders messages by priority within one queue. Think about separate lanes, starvation, reserving part of a provider's capacity, and pacing at the source of the campaign.",
      insight: "Use one queue per channel and priority (sms-high, sms-bulk) and let workers drain high first; strict priority is safe because transactional traffic is small, and weighted polling is the fallback if it ever is not. Reserve a slice of each provider's rate, say 20%, for the high lane, and have the campaign fan-out job emit at the provider's rate in per-time-zone batches, so the backlog stays bounded and quiet hours are respected.",
    },
    {
      prompt: "Providers return server errors, rate-limit you, report dead device tokens or reject payloads. How should the adapter react to each, and what happens when a provider is down?",
      hint: "Classify before you retry. Which answers should never be retried? Which channels have a second provider, and why might a cold standby email provider be a problem?",
      insight: "Classify every answer: transient (retry with backoff and jitter, honouring Retry-After), rate-limited (lower the pacer), recipient gone (mark the token or address invalid, never retry) and our fault (dead-letter and alert). A circuit breaker per provider fails SMS and email over to a standby kept warm with about 10% of traffic for sender reputation, while push has no alternative road, so each message's expiry decides; retry in one layer only and reconcile status from webhooks plus polling.",
    },
  ],
  tradeoffs: [
    "Calling providers synchronously vs a durable queue first: choose the queue, because direct calls collapse at 100× and couple every caller to provider latency.",
    "One queue with a priority field vs one lane per priority: use lanes, because neither Kafka nor SQS reorders within a queue, and a consumer that always drains high first would starve bulk anyway.",
    "Kafka vs SQS for the lanes: Kafka for replay, per-user ordering and other consumers; SQS for per-message visibility timeouts, built-in dead-letter redrive and no cluster to run. Either way the consumer must tolerate redelivery.",
    "Resend vs drop after an ambiguous crash: resend transactional messages, because a missing OTP is worse than two, and drop marketing ones, because a duplicate complaint costs more than a missed coupon.",
  ],
  followUps: [
    "A user opts out while their marketing message waits 20 minutes in the bulk lane. How do you honour the opt-out?",
    "Provider webhooks arrive late and out of order. How do you keep each delivery's status correct?",
    "The delivery store sees 30k writes a second during a spike. How does it cope, and what changes at 10×?",
    "How do you stop an internal service from turning this system into a spam or phishing cannon?",
  ],
};
