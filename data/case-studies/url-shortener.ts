import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "url-shortener",
  title: "Design a URL shortener",
  track: "hld",
  level: "intermediate",
  minutes: 30,
  scenario: "Design a service like bit.ly. A user submits a long URL and gets back a short one; anyone who opens the short URL is redirected to the original. Plan for 1 billion URLs over ten years and 100M monthly active users, with about a thousand reads for every write.",
  focus: "Reads outnumber writes 1,000 to 1 on a small dataset: about 3 writes/s, 3,000 reads/s and 500 GB over ten years. That fits one database, so this is a caching problem, not a sharding problem.",
  concepts: ["system-shapes", "estimation-formulas", "http", "indexing", "caching", "idempotency"],
  steps: [
    {
      prompt: "Before any numbers: what must the service do, what will you leave out, and which non-functional property matters most once a short link has been printed on a poster?",
      hint: "Think about everyone holding a link when a redirect fails, compared with a read that returns a slightly old mapping. Does a mapping ever change once it is written?",
      insight: "Shorten, redirect, an optional custom alias and an optional expiry; click analytics, accounts and spam detection are out of scope for now. Favour high availability (99.99%) over strong consistency: a dead link is broken for everyone who has it, while a mapping never changes once written, so a stale read is rare and harmless.",
    },
    {
      prompt: "With 1 billion URLs over ten years and a 1,000:1 read-to-write ratio, what are the write rate, the read rate and the total storage? What do those numbers say about sharding?",
      hint: "Ten years is about 3 × 10⁸ seconds. Assume about 500 bytes per row, then compare the total with what one well-provisioned database server holds.",
      insight: "About 3 writes/s, 3,000 reads/s on average and roughly 500 GB in total, which fits one PostgreSQL instance, so there is no sharding. The shape is read-heavy with tiny objects, so the design effort goes into fast reads, and saying that out loud is a green flag.",
    },
    {
      prompt: "Sketch the two endpoints and the table. What does each endpoint return on success and on failure, and what makes a lookup by code fast across a billion rows?",
      hint: "One endpoint creates and one redirects. List the errors that a custom alias, an expiry date and abuse introduce, then ask which index the redirect lookup needs.",
      insight: "POST /urls returns 201 with the short URL, or 400 for a bad URL, 409 when an alias is taken and 429 when rate limited; GET /{code} redirects, or returns 404 or 410 for an expired link. The table holds id, short_code (UNIQUE), long_url, created_at and expires_at, and the unique constraint builds a B-tree index, so a lookup is a few steps rather than a scan.",
    },
    {
      prompt: "How will you generate short codes that are guaranteed unique, and how many characters do they need?",
      hint: "Compare keeping part of the URL, hashing and truncating, and a counter. For length, work out how many codes six or seven characters of 0–9, A–Z and a–z can express. What does the birthday paradox say about truncated hashes?",
      insight: "Hash-and-truncate collides early (after roughly the square root of the code space), so it needs salt, retries and a lookup per write. A single atomic counter, such as Redis INCR with persistence and a replica, encoded in base 62 is unique by construction: one insert, no checks. 62⁶ is about 57 billion codes, so six characters cover 1 billion URLs; scramble the ID first if sequential codes must not be guessable.",
    },
    {
      prompt: "Should the redirect be a 301 or a 302, and why does the choice matter for this product's requirements?",
      hint: "Think about what the browser does with each status after the first click, and which requirements need your server to see later clicks.",
      insight: "Choose 302. A 301 is cached by the browser, so later clicks never reach you and expiry, edits and analytics become impossible; a 302 sends every click to your server, and a cache keeps that extra load cheap.",
    },
    {
      prompt: "A festival-sale link goes viral. How do you keep redirects under 200 ms and the whole service at 99.99%?",
      hint: "The unique index already makes one lookup cheap. Think about traffic skew, which eviction policy suits links that were clicked recently, how long a cached entry may live, and what must exist twice.",
      insight: "Put Redis in front of PostgreSQL as a cache-aside layer with LRU eviction and a TTL of about a day, never beyond the link's expires_at. The 99.99% target needs redundancy everywhere: several stateless app servers behind a load balancer, a PostgreSQL replica with failover and a Redis replica, but no queue or sharding on the redirect path.",
    },
    {
      prompt: "Two users ask for the alias /diwali-sale at the same instant. How do you make sure exactly one gets it, and that it never clashes with a code the counter produces later?",
      hint: "A check-then-insert in the application leaves a gap between the check and the insert. Which component can make the decision atomically? Then think about which namespace the generated codes live in.",
      insight: "Let the database's unique constraint decide: insert, and return 409 Conflict if the insert fails. Keep aliases in their own namespace, for example longer than six characters, or have the generator skip codes already taken, so a later counter value never lands on an alias.",
    },
  ],
  tradeoffs: [
    "Counter plus base 62 vs hash and truncate: choose the counter, because it is unique by construction with one insert and no retries, while truncated hashes collide after roughly the square root of the code space.",
    "301 vs 302: choose 302, because expiry and analytics need every click to reach the server, and a cache keeps the extra load cheap.",
    "One PostgreSQL instance vs sharding: choose one instance, because 500 GB and 3 writes/s fit comfortably; sharding only enters at about 100M writes a day.",
    "One Redis counter vs per-server ID ranges: the single counter is simplest; ranges handed out in batches also work and take Redis off most writes, provided each server owns its own range.",
  ],
  followUps: [
    "How would you add click analytics without slowing the redirect?",
    "If writes grew to 100M a day, what would change in storage, code length and sharding?",
    "Sequential codes let anyone walk through every link. How would you prevent that without losing uniqueness?",
    "What goes wrong if the Redis counter restarts without persistence, and how do you prevent it?",
  ],
};
