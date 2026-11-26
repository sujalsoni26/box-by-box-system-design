import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 5: Performance and Reliability, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Performance and reliability: failure is normal
  caching: {
    breaks: "When a celebrity post goes viral, the database answers the same query millions of times, runs out of CPU and connections, and every user's feed slows down, not just the fans'.",
    tradeoffs: "Cached data can go stale, invalidation is famously hard, RAM is limited, and you must handle stampedes, hot keys and cold starts.",
    explainSimply: "A cache is a small, fast memory that keeps answers you will probably need again. It's like keeping the spices you use daily on the counter instead of fetching them from the storeroom each time. The hard part is noticing when the storeroom version has changed.",
    hint: "After the database changes, the old cached value is the problem; think of the simplest action that guarantees nobody keeps reading it.",
  },
  "message-queues": {
    breaks: "When a million photos are uploaded at once, the resize workers drown and crash, and any photo a worker was halfway through is lost with no record that it needs redoing.",
    tradeoffs: "You run one more system, results arrive later, ordering isn't always guaranteed, and redelivery means the same message can be processed more than once.",
    explainSimply: "A message queue is a waiting line for jobs. The app drops a job in the line and moves on, and workers take jobs as fast as they can. A job is crossed off only after a worker finishes it, so a crash puts it back in line.",
    hint: "Think about what happens if a worker finishes a job but crashes before it says it is done.",
  },
  pubsub: {
    breaks: "If the post service calls notifications, analytics, moderation and recommendations one by one, every new feature means editing and redeploying the post service, and one slow subscriber delays every new post.",
    tradeoffs: "It's hard to trace who reacts to what, subscribers must cope with eventual consistency and with duplicate or out-of-order events, and event formats must evolve carefully.",
    explainSimply: "Pub/sub works like a newsletter. The post service publishes one announcement that a post was created, and every team that subscribed gets its own copy. A new team can subscribe without the sender changing anything.",
    hint: "Picture a pile of jobs to share out versus a news announcement, and count how many receivers get each item in each case.",
  },
  availability: {
    breaks: "Without an availability target, nobody knows whether a two-hour outage is a disaster or acceptable, and a chain of dependencies quietly drags uptime below what you promised.",
    tradeoffs: "Each extra nine cuts allowed downtime 10× and costs far more engineering: redundancy, multi-region deployments, automated failover and no maintenance windows.",
    explainSimply: "Availability is the share of time your app works, written as a percentage like 99.9%. That sounds high, but 99.9% still allows about 8.76 hours of downtime a year. Each extra 9 cuts that by 10× and needs spare copies of everything, so one failure doesn't stop the service.",
    hint: "If each service fails on its own, what has to go right for a request that needs both of them?",
  },
  "timeouts-retries": {
    breaks: "When the ranking service hangs, the feed service's threads wait on it until the feed fails too, and if every client then retries at once, the struggling service gets several times its normal traffic.",
    tradeoffs: "A timeout set too short fails slow but healthy calls and one set too long ties up threads, while every retry adds load and can duplicate a write that isn't idempotent.",
    explainSimply: "A timeout is deciding how long you'll stay on hold before hanging up. A retry is calling back, but if everyone redials the instant the line drops, the switchboard jams. So you wait longer each time, add a random pause, and only redial for problems that might clear up.",
    hint: "Think about how a crowd of clients that failed together should behave, and which requests would cause harm if they ran twice.",
  },
  "circuit-breaker": {
    breaks: "When the recommendations service dies, every feed request waits for its timeout and retries, threads pile up, and the feed service goes down even though only recommendations was broken.",
    tradeoffs: "While the breaker is open, users get a fallback such as cached data or a default instead of the real answer, and you must tune the failure threshold and cooldown.",
    explainSimply: "A circuit breaker works like the trip switch in your fuse box. When a service keeps failing, the breaker trips and the app stops calling it, giving a quick fallback answer instead. Later it checks carefully whether the service has recovered.",
    hint: "The breaker can't stay open forever; think about how it cautiously tests the dependency, and what each result leads to.",
  },
  backpressure: {
    breaks: "During a big ticket release, a service that accepts every request gets slow for everyone, timeouts and retries pile on, and the overload cascades into the services that call it.",
    tradeoffs: "Some users get a fast 503 instead of an answer, and you must tag each request with a criticality level so the least important work is dropped first.",
    explainSimply: "Backpressure is a busy part of the system telling whoever sends it work to slow down. Load shedding goes further: like a lift with a weight limit, it refuses extra passengers so it can still move. It turns away the least important work first, such as recommendations, so checkout keeps working.",
    hint: "Compare slowing down every request with quickly refusing a few, and think about which requests users would miss least.",
  },
  "rate-limiting": {
    breaks: "One scraper or buggy script sending thousands of requests a minute eats the capacity everyone shares, so normal users see slow pages and your cloud bill jumps.",
    tradeoffs: "A local limiter on each instance is fast but approximate, while a global limiter is accurate but needs a highly available shared store such as Redis and more complexity.",
    explainSimply: "A rate limiter gives each client an allowance, such as 100 requests a minute. A common version is a jar that refills with tokens at a steady rate: each request spends one, and an empty jar means come back later. Saved-up tokens let a client send a short burst.",
    hint: "Ask whether each error is about this client's usage or the server's own health, and what that means for when the client should try again.",
  },
  idempotency: {
    breaks: "When the payment response is lost on a flaky network and the app retries, the server sees a brand-new request and charges the customer twice.",
    tradeoffs: "The server must store each key with its result, ideally in the same transaction as the work, deal with repeats that arrive at once or with a different body, and expire old keys.",
    explainSimply: "An idempotent action has the same effect whether you do it once or five times, like setting a thermostat to 21 degrees. Paying is not like that, so the app attaches a unique ID to each payment request and reuses it on every retry. If the same ID arrives again, the server returns the earlier result instead of charging twice.",
    hint: "The key recognises one request sent many times; ask whether two different users sending two different requests looks like that.",
  },
};
