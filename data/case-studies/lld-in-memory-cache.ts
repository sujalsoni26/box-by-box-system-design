import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-in-memory-cache",
  title: "Design an in-memory cache",
  track: "lld",
  level: "intermediate",
  minutes: 35,
  scenario: "Build a generic, bounded, in-process cache with get, put and remove. When full it evicts by a policy, least recently used by default with least frequently used possible; it supports an optional time to live per entry, reports hits, misses and evictions, and offers a read-through mode that loads a missing value once however many threads ask. Capacity is ten thousand to a million entries, reads outnumber writes ten to one, and no hot-path operation may take time proportional to the number of entries.",
  focus: "Keeping storage and eviction order apart so that both lookup and choosing a victim are O(1) with the policy swappable, then layering expiry, statistics, single-flight loading and locking on that core.",
  concepts: ["caching", "design-patterns-behavioural", "design-patterns-structural", "concurrency-basics", "testing-extensibility"],
  steps: [
    {
      prompt: "What does the cache promise, what do you assume, and what do you leave to the system-level caching discussion?",
      hint: "Pin down the operations, how capacity is measured and the cost ceiling on the hot path. Persistence and anything spanning machines change the problem entirely.",
      insight: "The cache offers get, put, remove and size; a capacity in entries with policy-driven eviction; an optional per-entry time to live; statistics; and a read-through loader. Assume one process, immutable values and entries rather than bytes (weighing is an extension), with no hot-path cost proportional to size; persistence, replication and cache-aside versus write-through belong to the system-level lesson.",
    },
    {
      prompt: "A HashMap gives O(1) lookup but no order. How do you also find the least recently used entry in O(1), and move an entry to 'most recent' on a hit without searching for it?",
      hint: "Think of a structure where removing a node from the middle costs constant time if you already hold the node. Where could the node's pointers live so that the map lookup hands them to you?",
      insight: "A HashMap from key to Entry, plus a doubly linked list threaded through the entries themselves via prev and next fields, with head and tail sentinels so unlinking never checks for null. A hit is one hash lookup and a four-pointer relink to just before the tail, and the victim is always head.next.",
    },
    {
      prompt: "LRU today, LFU for another team tomorrow. How do you make the eviction order replaceable without touching get and put, and should the policy's interface speak in keys or in entries?",
      hint: "List the events the policy must hear about. If the policy received keys, what extra structure would it need inside itself?",
      insight: "An EvictionPolicy Strategy is told onInsert, onAccess and onRemove and asked for victim(); BasicCache never names LruPolicy. It speaks in entries, not keys, so it never needs a second hash lookup, at the cost that cache and policy are coupled through Entry and LRU ignores a frequency field.",
    },
    {
      prompt: "How do expired entries stop being returned and get their memory back? And where do statistics and single-flight loading go?",
      hint: "One mechanism catches entries that someone reads; another catches entries nobody reads again. For statistics and loading, think of wrappers that share the Cache interface.",
      insight: "Lazy expiry on read compares the deadline with an injected Clock, and a sweeper on scheduleWithFixedDelay removes a bounded batch per tick so it never holds the lock for long. Statistics are a StatsCache Decorator with LongAdder counters; LoadingCache keeps a ConcurrentHashMap of in-flight futures, so putIfAbsent elects one loader per key, the rest wait on its future, and the load runs outside every cache lock.",
    },
    {
      prompt: "A put arrives for a key that is already cached, in a full cache. What should happen? And what if the loader throws while forty threads are waiting on it?",
      hint: "Ask whether the cache actually grows. For the loader, think about what the waiters should see and what the next caller after them should do.",
      insight: "Updating an existing key replaces the value and deadline and counts as an access; size does not grow and no victim is chosen, which a naive design gets wrong by evicting on every update. A failing load completes the future exceptionally and removes it, so every waiter sees the failure and the next caller retries; a timeout on the wait turns a stuck database into a fast failure.",
    },
    {
      prompt: "Many threads read the cache. Would a ReentrantReadWriteLock help an LRU cache? What would you start with, and what would you move to under contention?",
      hint: "Look at what an LRU get does to the list. Is any operation actually read-only?",
      insight: "In LRU a read is a write, because every get relinks an entry, so a read-write lock buys nothing; start with one lock, which is simple, correct and keeps size exact. Under contention, stripe by key hash and accept approximate eviction across segments, or buffer accesses and apply them to the list in batches; StampedLock optimistic reads help only a cache with no recency order.",
    },
  ],
  tradeoffs: [
    "An explicit map and list vs LinkedHashMap with access order: choose LinkedHashMap when you need an LRU map and nothing else; build the explicit version once TTL, statistics or another policy must hook in.",
    "One lock vs lock striping: choose one lock for correctness and an exact size; stripe when profiling shows contention, accepting approximate eviction across segments.",
    "Lazy expiry plus a sweeper vs a sweeper alone: choose both because the read-time check keeps every read correct while the sweeper reclaims entries nobody reads again, accepting that size briefly counts stale entries.",
    "LRU vs LFU as the default: choose LRU because recency adapts when the workload shifts; LFU keeps yesterday's hot keys until their counts are aged down.",
  ],
  followUps: [
    "Design LFU with O(1) access and eviction.",
    "Make capacity a byte budget rather than an entry count. What replaces map.size()?",
    "Add a removal listener without letting a slow listener stall the cache.",
    "The wall clock is corrected backwards by a minute. What happens to time to live, and how would you fix it?",
  ],
};
