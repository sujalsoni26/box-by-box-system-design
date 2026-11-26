import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-pastebin",
  title: "Design Pastebin",
  track: "hld",
  level: "intermediate",
  minutes: 35,
  scenario: "Design a Pastebin: a user pastes a block of text, gets a short URL, and anyone with the URL can read the paste until it expires. Pastes average 10 KB but may reach 10 MB, there are 10M new pastes a day, reads are ten times writes, and pastes are kept for up to five years.",
  focus: "About 180 TB of immutable text bodies over five years, at request rates one database barely notices. This is the storage-heavy shape, so bodies and metadata must live in different stores.",
  concepts: ["url-shortener", "system-shapes", "object-storage", "cdn", "caching", "rate-limiting"],
  steps: [
    {
      prompt: "What does Pastebin need beyond the URL shortener, and which failure and which freshness rule would users never forgive?",
      hint: "A paste is read for a while and then expires. Think about losing a paste before its expiry, and about how long an expired or deleted paste may still be shown to someone.",
      insight: "Create a paste of up to 10 MB with optional expiry, custom URL and visibility (public or unlisted), read it as a page or raw text, and let the owner delete it; highlighting, editing, search and malware scanning are out. Durability before expiry is non-negotiable and reads should take under 200 ms, while availability beats strong consistency because a paste never changes, with one freshness rule: an expired or deleted paste stops being served within a minute.",
    },
    {
      prompt: "With 10M pastes a day at 10 KB, a 10:1 read ratio and five-year retention, which number dominates, and how does it compare with the shortener's 500 GB?",
      hint: "Work out writes per second, then body bytes per day and over about 1,825 days. Do the same for roughly 200 bytes of metadata per paste. Which of the two outgrows a single database?",
      insight: "About 100 writes/s and 1,000 reads/s, but 100 GB of bodies a day and roughly 180 TB over five years, against only about 3.6 TB of metadata. That is the storage-heavy shape, 360 times the shortener's dataset, so bodies go to object storage and metadata stays in SQL, and the 200 GB daily hot set is a CDN's job rather than Redis's.",
    },
    {
      prompt: "Design the create and read API and the paste row. How should ids be generated, given that an unlisted paste's URL is its only protection, and in which order are the body and the row written?",
      hint: "The shortener used a counter. Ask what a sequential id lets a stranger do here. Also ask whether every 10 KB paste deserves an extra round trip to upload straight to storage, and which half-finished write a user could actually see.",
      insight: "Ids are 8 random base-62 characters (about 2.2 × 10¹⁴ values), random because sequential ids can be walked, with the rare collision caught by the primary key. Small bodies are sent inline through the service and only bodies over 1 MB use a pre-signed upload followed by a complete call. The row holds paste_id, owner, body_key, size, content_hash, visibility, status and expires_at, and the body is written before the row, so the only possible inconsistency is an orphan body a daily job can sweep.",
    },
    {
      prompt: "For a 10 MB paste the client uploads straight to object storage with a pre-signed URL. What can go wrong, and how do you guard against it?",
      hint: "Consider how many bytes the URL lets someone send, how long the URL stays valid, and what happens when the client never calls complete.",
      insight: "A plain pre-signed PUT cannot cap the size, so use the POST-policy form with a content-length-range condition and re-check the stored size on complete. Treat the URL as a bearer token valid for minutes, not days, and let a sweeper delete rows still pending after an hour, together with their objects.",
    },
    {
      prompt: "Pastes expire all day long. How do you guarantee nobody reads an expired paste, and how do you reclaim 100 GB of space a day?",
      hint: "Ask which of the two jobs must happen on time and which may run late. Where can a copy of a paste outlive its row? How reliable are object-store lifecycle rules as a deadline?",
      insight: "Correctness is enforced on the read path: every origin read checks expires_at and status, and Redis TTLs and the CDN's s-maxage are capped at the remaining lifetime, so no copy outlives the paste. Cleanup may run late: lifecycle rules on expiry-class key prefixes delete bodies, a sweeper or weekly time partitions (DROP TABLE) remove rows, and explicit deletes or takedowns delete the object directly and purge the caches, because lifecycle expiry can lag by days.",
    },
    {
      prompt: "A paste linked from a busy forum draws thousands of reads a second for an hour. How do the tiers share that load, and what changes if the paste is unlisted?",
      hint: "A paste is immutable. Think about what may sit in a public edge cache, how to stop a stampede on a brand-new viral paste, and which kind of key a scanner makes hot.",
      insight: "Public pastes are served from the CDN with s-maxage capped at the time left, so only the first read per edge reaches the bucket; Redis holds metadata cache-aside with TTL jitter, single-flight on a miss and cached 404s. Unlisted pastes cannot sit in a public edge cache, so the service streams them, or the CDN serves them through signed URLs when they are a large share of the hot set.",
    },
  ],
  tradeoffs: [
    "Bodies in PostgreSQL vs object storage: keep them in SQL while total body volume is around a terabyte, and move them to object storage once they dominate, because otherwise every backup, replica and vacuum pays SQL prices for blobs the database never looks inside.",
    "Proxying small bodies vs a pre-signed upload for every paste: proxy bodies under 1 MB, because ingress is only about 1 MB/s and a direct upload adds a round trip for 10 KB.",
    "Partitioning metadata by time vs by id: by time makes deletion a DROP TABLE but moves custom-URL uniqueness into a separate aliases table; by id keeps a simple unique key but leaves bulk deletes and vacuum.",
    "Random ids vs a counter: choose random, because an unlisted paste's URL is its only protection and sequential ids can be walked.",
  ],
  followUps: [
    "At 100M pastes a day, which part of the design breaks first, and what would you change?",
    "How do you stop the service being used as free file storage or to host malware?",
    "Why serve raw pastes as text/plain with nosniff from a separate domain?",
    "Could you deduplicate identical bodies, and what would it cost?",
  ],
};
