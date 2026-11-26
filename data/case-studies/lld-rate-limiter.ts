import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-rate-limiter",
  title: "Design a rate limiter library",
  track: "lld",
  level: "intermediate",
  minutes: 30,
  scenario: "A gateway calls a rate limiter on every request to decide, per client key, whether to allow it, and needs a retry-after time for its 429 responses. Support token bucket, sliding window log and fixed window counter as interchangeable algorithms, with about a hundred thousand active keys and fifty thousand checks a second in one process. A decision must take microseconds, be thread-safe, and be testable without sleeping.",
  focus: "Putting each algorithm behind one small interface that knows nothing about keys or threads, keeping state per key refilled lazily from an injected monotonic clock, and making each key's update atomic without a global lock.",
  concepts: ["rate-limiting", "time-and-ordering", "design-patterns-behavioural", "concurrency-basics", "testing-extensibility"],
  steps: [
    {
      prompt: "What does the caller need back from the limiter beyond yes or no, and what do you rule out of scope?",
      hint: "Think about what the middleware writes in a 429 response. Then consider memory if every client ever seen kept its state, and what changes once several servers must share one limit.",
      insight: "The call tryAcquire(key, permits) returns a Decision with allowed, a retry-after time and the remaining permits, so middleware can answer 429 with a Retry-After header. Limits are per key, the three algorithms are interchangeable, idle keys are forgotten so memory tracks active clients, and a limiter shared across servers is a different design, out of scope here.",
    },
    {
      prompt: "How many interfaces do you need, and which class should be the only one that knows about both keys and algorithms?",
      hint: "Callers think in client keys. Algorithms think in permits and time. Should a token bucket ever hear about a map, a thread or an HTTP request?",
      insight: "Two interfaces: RateLimiter for callers, which speaks in keys, and LimiterState for algorithms, which speaks in permits and a timestamp. KeyedRateLimiter is the only class that knows both and the only one with a map in it; a RateLimitFilter in the HTTP chain picks the key and writes the 429.",
    },
    {
      prompt: "A bucket gains ten tokens a minute. Who adds the tokens, and where does the current time come from?",
      hint: "A hundred thousand timers would be expensive. What could a bucket work out for itself at the moment a request arrives? Then consider what a wall-clock correction would do to an elapsed time.",
      insight: "Nothing runs between requests: each call refills lazily from the time elapsed since the bucket last looked, capped at capacity, so cost is proportional to requests, not keys. Time comes from an injected monotonic nanosecond Clock, so a wall-clock correction can neither make elapsed time negative nor grant a free refill, and tests step time by hand instead of sleeping.",
    },
    {
      prompt: "Compare token bucket, sliding window log and fixed window counter on state per key, burst behaviour and precision. How do you plug the chosen one in?",
      hint: "Consider what each one must remember, and what happens to a client that sends a full limit just before and just after a window boundary.",
      insight: "The fixed window keeps two numbers and can allow twice the limit across a boundary; the sliding log keeps a timestamp per allowed request and is exact; the token bucket keeps two numbers and allows a burst of capacity, then the steady rate. Each is a LimiterState Strategy, and the limiter takes a Supplier so every new key gets a fresh state of the chosen class.",
    },
    {
      prompt: "Two first requests for a brand-new key arrive together, and the idle sweeper evicts a key while a request is using its state. How do you make both harmless?",
      hint: "Look for an atomic create-if-missing on the map. For eviction, think about how long an untouched bucket takes to become full on its own.",
      insight: "ConcurrentHashMap.computeIfAbsent is atomic, so both first requests get the same state object; the supplier is short and does not touch the map, as computeIfAbsent requires. Choose an idle period of at least capacity divided by the refill rate, because by then a bucket is full anyway, so a decision that lands on an evicted orphan and the fresh, full state that replaces it are indistinguishable.",
    },
    {
      prompt: "Tokens and last-refill time must change together. Give two correct ways to make one bucket's update atomic, and say when you would prefer each.",
      hint: "One leans on Java's built-in locking of an individual object. The other avoids locks with an atomic primitive, which forces the two numbers to travel together as one value. What must be true of a loop that may run more than once?",
      insight: "A synchronized tryAcquire on each bucket is a lock per key, lock striping for free: different clients never contend. Alternatively, keep both numbers in one immutable record inside an AtomicReference and loop with compareAndSet, recomputing when another thread won, with a body free of side effects; prefer synchronized for ordinary keys and the CAS loop for one hot key hit by many threads, and measure before switching.",
    },
  ],
  tradeoffs: [
    "Lazy refill vs a timer thread: choose lazy refill for no background work and cost proportional to requests, at the price of elapsed-time arithmetic on every call.",
    "A synchronized bucket vs a CAS loop: choose synchronized for keys touched by a handful of threads; the CAS loop for one hot key, accepting a small allocation per call.",
    "Sliding window log vs sliding window counter: choose the log when exactness matters, accepting a timestamp per allowed request; choose the counter for a hundred million keys because two numbers per key are enough and its error is tiny.",
    "Recording denied requests vs ignoring them: choose recording when abusive clients should stay locked out longer, because their hammering keeps the window full; choose ignoring when a client should get through as soon as the window frees. Either is defensible if you say which.",
  ],
  followUps: [
    "The limit must now be shared by several servers. What moves, and what stays exactly the same?",
    "Explain the sliding window counter with a worked example.",
    "A caller asks for more permits than the bucket's capacity. What do you do?",
    "A port scan creates a million keys in a minute. How do you bound memory?",
  ],
};
