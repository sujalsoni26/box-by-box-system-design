import type { LessonMeta } from "@/types/curriculum";

/** Module 6: System Design Practice. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/practice.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "estimation-numbers", title: "Numbers to memorize", moduleId: "practice", level: "basic", minutes: 6,
    problem: "Without rough numbers you draw boxes by guesswork: you cannot tell whether you need a cache, sharding or a CDN.",
    summary: "Round aggressively: a day is about 10⁵ seconds, each byte unit is 1,000× the last, and a few capacity rules of thumb (1k QPS per app server, 1–5k writes/s per SQL node, 100k ops/s per Redis node) carry most estimates.",
    catTip: "A day has 86,400 seconds. I round it to 100,000 because I am a cat and I have naps to schedule. The estimate is still close enough.",
    recall: { q: "How many seconds are in a day, rounded for estimation?", a: "86,400, rounded to 10⁵ seconds." },
    archNodes: [],
  },
  {
    slug: "estimation-formulas", title: "The formulas", moduleId: "practice", level: "basic", minutes: 8,
    problem: "You have users and actions; you need QPS, storage, bandwidth, cache size and a server count, said out loud in about a minute.",
    summary: "A handful of formulas turn DAU and object sizes into QPS, storage, bandwidth, cache and servers. Design for peak, not average, and say every assumption before you compute.",
    catTip: "Average QPS is DAU times actions, divided by 10⁵. I memorised it by chanting it at 3 a.m. The humans were thrilled.",
    recall: { q: "What is the formula for average QPS, and how do you get peak?", a: "DAU × actions per user per day ÷ 10⁵. Peak ≈ average × 2–3 (5–10× for IPL matches, flash sales, ticket drops)." },
    archNodes: [],
  },
  {
    slug: "estimation-examples", title: "Worked examples", moduleId: "practice", level: "intermediate", minutes: 9,
    problem: "Formulas only stick once you run them on real systems and see which number dominates.",
    summary: "A URL shortener at 100M writes/day is read-heavy with tiny objects: about 1 PB over 10 years, so cache and replicas. Google Drive has the same 1k writes/s but 500× bigger objects, so storage and bandwidth dominate.",
    catTip: "Same number of mice per second, but one of them is the size of a tiger. Suddenly storage is the problem, not speed. That is URL shortener versus Google Drive.",
    recall: { q: "A URL shortener at 100M URLs/day for 10 years: how many records, and how many base-62 characters?", a: "About 365 billion records. 62⁷ ≈ 3.5 trillion covers it, so 7 characters (62⁶ ≈ 57 billion is too few)." },
    archNodes: [],
  },
  {
    slug: "system-shapes", title: "Three system shapes", moduleId: "practice", level: "intermediate", minutes: 5,
    problem: "Different systems are dominated by different numbers, and the dominant number decides the design.",
    summary: "Most systems fall into three shapes: read-heavy with tiny objects, storage- and bandwidth-heavy, or write-heavy streams. Find the number that dominates, then design for it.",
    catTip: "Some cats nibble all day, some eat one enormous meal, some never stop. Know which cat you are feeding before you buy the bowl.",
    recall: { q: "A chat app sending 100 billion messages a day is which system shape?", a: "A write-heavy stream: append-only logs (Kafka), sequential I/O, queues and partitioning." },
    archNodes: [],
  },
  {
    slug: "final-architecture", title: "The final architecture", moduleId: "practice", level: "intermediate", minutes: 6,
    problem: "Thirty-odd building blocks are easy to learn one at a time and hard to see as one system.",
    summary: "Every block sits where its problem appears: DNS and the CDN at the edge, a gateway in front of stateless services, caches before databases, queues before workers.",
    catTip: "Select any box on the map and I will show you the topics that explain it. Boxes glow as you finish topics. I like glowing things.",
    recall: { q: "In the final architecture, what happens to a slow side effect such as resizing a photo?", a: "The service puts it on a message queue; workers process it asynchronously and store the results in object storage." },
    archNodes: [],
  },
  {
    slug: "revision-map", title: "Revision: problem to building block", moduleId: "practice", level: "basic", minutes: 9,
    problem: "You know each block; now you need to recall the right one the moment a problem is named.",
    summary: "Every card is a problem and the building block that solves it. Answer from memory, flip to check, then skim the full table.",
    catTip: "Say the answer out loud before you flip. It feels silly and it works. I say \"meow\" out loud constantly and I have never once forgotten it.",
    recall: { q: "Problem: \"a dead dependency spreading failure.\" Which building block?", a: "A circuit breaker." },
    archNodes: [],
  },
  {
    slug: "playbook", title: "The interview playbook", moduleId: "practice", level: "basic", minutes: 6,
    problem: "In an interview, a blank whiteboard and 45 minutes invite you to draw boxes in random order.",
    summary: "Seven steps: functional requirements, non-functional requirements, estimation, API, data model, high-level design, deep dives. Start with one server and one database and add a box only when a requirement forces it.",
    catTip: "Seven steps, like my morning: stretch, yawn, demand breakfast, eat, judge you, groom, nap. Skip one and the whole day goes wrong.",
    recall: { q: "What are the seven steps of the design playbook?", a: "Functional requirements, non-functional requirements, estimation, API, data model, high-level design, deep dives." },
    archNodes: [],
  },
  {
    slug: "test-yourself", title: "Test yourself", moduleId: "practice", level: "intermediate", minutes: 25,
    problem: "Reading feels like learning; recalling is what actually makes it stick.",
    summary: "Twenty questions across the whole course, as flip cards. Answer out loud first, then flip. Finish with the estimation drill.",
    catTip: "Trying to remember is what builds the memory, even when you get it wrong. I forget where I hid my toys all the time, and I am extremely clever.",
    recall: { q: "Why does horizontal scaling require stateless servers?", a: "So any server can handle any request. If one server's memory holds your session, a request landing elsewhere loses it; keep state in Redis, the DB or a token." },
    archNodes: [],
  },
];
