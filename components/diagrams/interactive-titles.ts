/**
 * Short, stable titles for the interactive diagrams, used by "On this page" before a diagram has loaded (each one
 * loads only as the reader scrolls near it). scripts/tests/outline.test.mjs checks that every registered diagram
 * has one.
 */
export const INTERACTIVE_TITLES: Record<string, string> = {
  "request-journey": "One request, end to end",
  "dns-lookup": "Resolve a domain name",
  "tcp-udp": "TCP vs UDP packet race",
  "latency-scale": "Latency numbers, to scale",
  "tail-latency": "The tail at scale",
  "littles-law": "Little's Law",
  "lb-sim": "Load balancer",
  "scaling-compare": "Scale up or scale out?",
  "polling-vs-ws": "Polling vs WebSocket",
  "index-scan": "Full scan vs index",
  "replication-lag": "The vanishing comment",
  "shard-router": "Which shard holds this user?",
  "cap-partition": "A network partition",
  "cache-aside": "Cache-aside with Redis",
  "queue-leveling": "Queue load leveling",
  "pubsub-fanout": "Queue vs pub/sub",
  nines: "Downtime per nine",
  "backoff-jitter": "Retry storms vs backoff + jitter",
  "circuit-breaker": "Circuit breaker",
  "token-bucket": "Rate limiter",
  idempotency: "Retry a payment safely",
  estimator: "Back-of-the-envelope estimator",
  base62: "Counter + base 62",
  "recall-cards": "Flashcards",
  "architecture-map": "The architecture map",
};
