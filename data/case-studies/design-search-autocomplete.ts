import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-search-autocomplete",
  title: "Design search autocomplete",
  track: "hld",
  level: "intermediate",
  minutes: 35,
  scenario: "Design the autocomplete for a search box: as a person types, show the ten most likely completions before they type the next character. Assume 10M daily search users making 10 searches a day, suggestions per language and region, trending terms that appear within minutes, and no offensive or private suggestions.",
  focus: "About 30k lookups a second at peak against an index of roughly 26 GB that changes hourly, with about 10 ms per lookup at the origin: nothing on the keystroke path may touch a disk or a database.",
  concepts: ["system-shapes", "caching", "cdn", "object-storage", "kafka-architecture", "stream-processing"],
  steps: [
    {
      prompt: "What exactly is returned for each keystroke, and how should the system behave when it is slow or broken?",
      hint: "Think about the delay at which a response stops feeling instant, whether a failing suggestion box should block search, how fresh rankings must be for news compared with the long tail, and what must never be suggested.",
      insight: "Up to ten ranked suggestions for a prefix, per language and region, with trending terms within minutes, typo tolerance, and no offensive or private terms. The budget is under 100 ms per keystroke end to end; suggestions degrade rather than block because search is the product; freshness comes in two speeds (head terms and news within minutes, the tail hourly); and each request must be cheap because there are ten for every search.",
    },
    {
      prompt: "How many suggestion requests arrive per second, how large is an index of precomputed answers, and how much time does a lookup get on a CDN miss?",
      hint: "About 10 suggestion requests per search after debouncing. Assume 50M kept queries, about 6 new prefixes each and 80 bytes per prefix entry. Subtract the mobile round trip and the edge-to-origin hop from 100 ms.",
      insight: "About 30k requests a second at peak, an index of about 300M prefix entries in roughly 26 GB that fits one node's RAM, and only about 30 ms at the origin, of which the lookup gets about 10. This is the URL shortener's read-heavy shape with a build pipeline behind it, so nothing on the hot path may touch a disk or a database.",
    },
    {
      prompt: "What should the suggest endpoint look like so a CDN can cache it, and what data structure answers a prefix in microseconds?",
      hint: "Put every ranking input into the URL. Ask whether ranking should happen per keystroke or ahead of time, and what to do with very long prefixes that match only a few queries.",
      insight: "GET /v1/suggest?q=&lang=&region= with Cache-Control: public, so the edge's cache key separates prefixes by language and region, while personal suggestions are a private variant. The serving index maps each prefix up to 20 characters to a precomputed top ten of (query_id, score), held in RAM and swapped as a whole; longer prefixes binary-search a sorted list of queries, because short prefixes match millions of queries and must be precomputed.",
    },
    {
      prompt: "How do you keep the keystroke path inside its budget at 30k requests a second, and how do you scale it?",
      hint: "Look at the client (fast typists, stale responses), the CDN (which prefixes carry most of the traffic), stampedes when a hot entry expires, and whether a 26 GB index needs sharding.",
      insight: "The client debounces by about 50 ms and cancels stale requests; the CDN caches by URL for 60 s, longer for one- and two-character prefixes, with request coalescing; and each suggest node holds the whole index in RAM and answers without a network call. Replicate rather than shard until the index outgrows one machine, then shard by a hash of the first two characters, and let the client treat no answer within 150 ms as no suggestions.",
    },
    {
      prompt: "How is the index built from millions of searches, and how do breaking-news terms appear within minutes without letting one bot make a term trend?",
      hint: "Separate the keystroke from the computation. What do you count, and over what window? How should older popularity fade? How much of a list may a sudden trend take over?",
      insight: "Searches flow into Kafka, a stream job counts distinct users per query per minute, and an hourly builder sums counts with a one-week half-life, offers queries best-first to each prefix's top ten and publishes an immutable, versioned snapshot that nodes swap atomically. A trending delta (more than five times the same window a week earlier, with at least 500 distinct users) is pushed every minute, may take at most two of the ten slots, expires unless renewed, and purges the prefixes it touches at the CDN.",
    },
    {
      prompt: "How do you tolerate a typo within the budget, and how do you make sure offensive or private queries never appear?",
      hint: "When is fuzzy matching worth doing, and how many candidates can a few-microsecond lookup afford? For filtering, remember that trending terms bypass the build, and think about a query only a handful of people have ever typed.",
      insight: "Fuzz only when the exact prefix returns fewer than ten results and has at least three characters, allowing one edit up to five characters and two beyond, each candidate one hash lookup. Filter at build time and again at serve time with a blocklist of patterns, because a reported term cannot wait for the next build and trending bypasses it, and suggest only queries seen from a minimum number of distinct users, which both defeats bots and protects privacy.",
    },
  ],
  tradeoffs: [
    "Precomputed top ten per prefix vs ranking at query time: precompute short prefixes, whose ranges are huge, and scan a sorted index for long prefixes, whose ranges are tiny, hence the cut at 20 characters.",
    "Replicating vs sharding the index: replicate while 26 GB fits one machine, because any node can then answer any prefix with no routing.",
    "Edge TTL vs freshness: a 60-second CDN TTL delays ranking changes by up to a minute, so trending deltas purge only the prefixes they touch.",
    "A Redis sorted set or a database vs an in-process index: in-process, because a network hop or a disk read spends the whole 10 ms budget.",
  ],
  followUps: [
    "A build produces an empty or broken index. How do you stop it reaching users?",
    "How would you add a user's own recent searches without breaking the CDN cache?",
    "At 100×, how could ranking become smarter while staying inside the budget?",
    "Why count distinct users rather than search events?",
  ],
};
