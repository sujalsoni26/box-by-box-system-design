import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-rate-limiter",
  title: "Design a distributed rate limiter",
  track: "hld",
  level: "intermediate",
  minutes: 35,
  scenario: "Design the rate limiter inside an API gateway that runs as dozens of instances. Every request must be checked against per-client, per-endpoint and per-tenant rules, at 50k requests a second on average and 150k at peak, and the check may add only a millisecond or two.",
  focus: "About 300k atomic read-modify-writes a second against only about 6 GB of counter state, each inside a 1 ms budget: a latency-and-contention problem, not a storage problem.",
  concepts: ["latency", "rate-limiting", "circuit-breaker", "multi-region", "api-gateway"],
  steps: [
    {
      prompt: "Who owns the limiter and who owns the rules, what must it support, and which non-functional requirement outranks accuracy?",
      hint: "Think about what a client sees when it is denied, how a rule changes without a deploy, and what happens to the whole API if the limiter itself breaks.",
      insight: "The platform team owns the limiter and service teams own the rules: per client, endpoint and tenant, 429 with Retry-After and rate-limit headers, rule changes without redeploying, allowlists and a dry-run mode. Decisions take 1–2 ms and may be a few percent inaccurate, but the limiter must never take the API down and two instances must never both grant the last token; billing-grade metering, load shedding and DDoS protection are out of scope.",
    },
    {
      prompt: "With 150k requests a second at peak, 10M clients and a handful of keys per client, what are the operation rate, the memory and the latency budget, and what do they rule out?",
      hint: "Count shared-store operations per request, multiply out about 100 bytes per bucket, and compare an in-region round trip (about 0.5 ms) with a cross-continent one.",
      insight: "Roughly 300k atomic operations a second at peak (one script per client plus one per tenant) against only about 6 GB of state, inside about 1 ms. That settles three things before any box is drawn: counters live in memory, in the same region as the gateways, and are updated atomically on the server rather than read, changed and written back.",
    },
    {
      prompt: "Where should the counters live: inside each gateway instance, in a central limiter service, or in a shared store the gateways call directly?",
      hint: "Weigh latency, accuracy and the number of network hops against the 1 ms budget. Could two of these work together, and where should rules be read from on the request path?",
      insight: "Local in-process buckets are fast but approximate because load balancing is uneven, and a central limiter service adds a second hop inside the budget. Choose shared counters in a per-region Redis Cluster called from a library in each gateway, with a local bucket in front as the first layer and the fallback, and deliver rules to every gateway as a versioned in-memory snapshot.",
    },
    {
      prompt: "Two gateway instances both read tokens = 1 and both admit the request. How do you make refill-and-spend correct under concurrency?",
      hint: "INCR is atomic, but a token bucket has a branch in the middle. Which Redis feature runs read, compute and write as one step, where should it get the time from, and what does Redis Cluster require of the keys it touches?",
      insight: "Run the token bucket as a Lua script loaded once and invoked with EVALSHA: Redis executes it atomically, it reads the time from TIME so gateway clocks never matter, and it must stay tiny because it blocks the shard while it runs. In a cluster every key must hash to one slot, so a hash tag such as {k_42} keeps a client's keys together, the tenant key is a second pipelined call, and a NOSCRIPT error after failover is handled by reloading the script.",
    },
    {
      prompt: "Redis becomes slow (p99 of 20 ms) or a shard dies. What should the gateway do, and who decides?",
      hint: "Compare failing open with failing closed: who pays in each case? Think about a timeout tied to the budget, and a way to stop paying that timeout on every request.",
      insight: "Decide per rule ahead of time: fail open for ordinary per-client and per-endpoint rates, fail closed only for hard paid quotas and brute-force targets such as login. Time out the Redis call at about 3 ms, open a circuit breaker after a run of timeouts, and fall back to the local bucket (the limit divided by the instance count), so open never means unlimited, and alert on the fail-open rate.",
    },
    {
      prompt: "One tenant sends 30k requests a second, and some clients spread traffic over two regions. How do you keep limits meaningful without a cross-region hop on every request?",
      hint: "A single hot key lands on one shard. Consider splitting a budget into parts, and compare dividing a global limit between regions with summing usage asynchronously.",
      insight: "Split a hot tenant's budget into N sub-keys, each with a share of the limit, and pick one at random per request, trading a little accuracy for spread. Keep counters in the region the traffic enters, because a cross-region round trip costs 50–150 ms: split a global budget by observed traffic for ordinary plans, sum usage asynchronously when accuracy matters, and route to a home region only for strict quotas.",
    },
  ],
  tradeoffs: [
    "Shared Redis counters vs local-only buckets: choose shared counters with a local layer in front, because local-only accuracy depends on how evenly the load balancer spreads traffic.",
    "Fail open vs fail closed: fail open for ordinary rates, because a limiter that causes an outage has failed at its one job; fail closed for hard quotas and login, where over-admitting is worse than a 429.",
    "A script call per request vs taking tokens in batches: per request is accurate; batches of 20 cut round trips but let a client overshoot by up to the batch size per instance, and become mandatory at 10× growth.",
    "Token bucket or sliding window counter vs a sliding log: keep two numbers per key, because a sliding log is exact but its memory grows with each client's rate.",
  ],
  followUps: [
    "How do you roll out a new rule safely when a bad rule could deny all traffic?",
    "Before authentication, for example on the login route, what should the limit key be, and why not a forwarded-for header?",
    "At 5M requests a second, how does the design change?",
    "A request passes the client and route checks but fails the tenant check. What happened to the tokens already spent, and does it matter?",
  ],
};
