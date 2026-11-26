import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-file-storage",
  title: "Design Google Drive / Dropbox",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design Google Drive or Dropbox. Users upload files of up to 50 GB from any device, see each change on their other devices within seconds, share folders with view or edit rights, and keep 30 days of versions. Assume 50M daily active users uploading two files a day of about 500 KB on average.",
  focus: "About 50 TB of new bytes a day (roughly 55 PB a year with three copies) makes storage and bandwidth dominate, but the hardest problems sit in the metadata: chunking, sync across devices, and two stores that cannot share a transaction.",
  concepts: ["estimation-examples", "object-storage", "websockets", "sharding", "idempotency", "distributed-transactions"],
  steps: [
    {
      prompt: "Which requirements are non-negotiable for a file sync product, and what would you put out of scope?",
      hint: "Think about losing a file, a 2 GB upload that fails at 90% on a phone, two devices holding stale copies, and a file entry that points at bytes that are not there.",
      insight: "Upload and download up to 50 GB, folders, sync to every device, sharing, 30 days of versions and a trash; real-time co-editing, search inside files and user-held encryption keys are out. Durability comes first, then bandwidth efficiency (upload only what the server lacks), resumable uploads, sync within seconds and metadata correctness: a file never appears twice, vanishes, or points at blocks that do not exist.",
    },
    {
      prompt: "Estimate upload rate, bandwidth, storage per year and metadata growth. Which numbers dominate, and which are bigger than they first look?",
      hint: "Start from 10⁸ uploads a day at 500 KB, three copies of every byte and about 1 KB of metadata per file. Assume around 20M devices are online at once.",
      insight: "About 1k uploads a second, the shortener's write rate on objects 500 times bigger: 500 MB/s each way, 50 TB a day and about 55 PB a year with three copies, so storage and bandwidth dominate. But metadata grows by about 36 TB a year and 20M idle connections must stay open, so the hardest problems are in the metadata, not the bytes.",
    },
    {
      prompt: "Design the upload API and the main tables. How do you keep the bytes off your application servers, and what identifies a block?",
      hint: "Let the client describe a file before it sends any bytes. What if each block were named by a hash of its contents? Which tables need a uniqueness rule, a version check and a change log?",
      insight: "Files become 4 MB blocks named by their SHA-256; POST /files sends the blocklist and receives need_blocks plus pre-signed URLs, the device PUTs those blocks straight to object storage, and a commit writes the version. The tables are files with UNIQUE (parent_id, name) and current_ver for compare-and-set, append-only versions, content-addressed blocks with a refcount, a per-namespace journal written in the same transaction as the version, and an ACL per namespace.",
    },
    {
      prompt: "Why split files into fixed-size, content-hashed blocks, and how does that one choice give you deduplication and resumable uploads? What does the block size trade?",
      hint: "Think about what the server can tell a client that sends it a list of hashes, and what a crashed client should send when it starts again. Then compare 1 MB, 4 MB and 64 MB blocks.",
      insight: "The server answers a blocklist with only the hashes it has never seen, so any block already stored is skipped, and a resumed upload re-offers the same list and sends only what is missing. Block size trades metadata rows against wasted bandwidth, and 4 MB suits general sync; an insert at the start of a file shifts every fixed boundary, which rsync-style rolling checksums can repair at the cost of CPU on every device.",
    },
    {
      prompt: "How does a device learn about changes, and what happens when two devices edit the same file offline and then reconnect?",
      hint: "Give every change in a namespace a sequence number. What does a device need to remember? For conflicts, rely on the database rather than clocks, and ask whether the server can merge two spreadsheets.",
      insight: "Each device keeps a cursor into the per-namespace journal and calls GET /changes?cursor= when woken by a long poll or WebSocket, downloading only the blocks it lacks and renaming files into place after verifying hashes. A second commit with a stale parent_version fails the compare-and-set with 409, and the client saves its version as a conflicted copy, because last-writer-wins would throw an hour of work away; for a large shared folder the wake-up carries only 'your cursor is stale'.",
    },
    {
      prompt: "The metadata database and the object store cannot share a transaction. Which way are they allowed to disagree, and how do you clean up the difference?",
      hint: "Compare a block that no version references with a version that references a missing block: which one loses data? Then picture a block whose refcount hits zero just as a new upload is told it already exists.",
      insight: "Bytes first, pointer last: blocks are uploaded before the commit and the commit verifies every hash, so the only possible inconsistency is orphan blocks, which cost money rather than correctness. A janitor deletes a block only after it has sat at refcount zero for longer than any upload can take (zero_since), re-reading the refcount in a transaction first, and its inventory alerts on any dangling reference, which must never exist.",
    },
  ],
  tradeoffs: [
    "Long polling vs WebSocket push: long polling suits a phone that syncs rarely and lets its radio sleep; a WebSocket suits a desktop in a busy shared folder. Many clients use both.",
    "Fixed 4 MB blocks vs content-defined chunking: start with fixed blocks because hashing is cheap; content-defined chunking survives inserts that shift boundaries but costs CPU on every device.",
    "Two-phase commit vs an ordering plus a janitor: object storage cannot join a distributed transaction, so order the writes so only orphans are possible and reconcile them in the background.",
    "Deduplicating across accounts vs within one account: cross-account dedup saves more bandwidth but turns 'you already have this block' into an oracle about other users' files.",
  ],
  followUps: [
    "A shared folder has 2,000 members with three devices each. What does one commit cost, and how do you keep it cheap?",
    "How quickly does revoking a share stop downloads, and what bounds that delay?",
    "At 10× (500 TB a day), what does the storage bill force you to change?",
    "Why is the client's local disk described as the largest cache in the system?",
  ],
};
