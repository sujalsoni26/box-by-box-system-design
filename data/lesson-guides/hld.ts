import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 14: High-Level Design Case Studies, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  "url-shortener": {
    breaks: "Skip the requirements and numbers and you shard a 500 GB dataset that fits on one PostgreSQL, or pick hash-and-truncate codes that start colliding after a few hundred thousand links.",
    tradeoffs: "Choosing 302 over 301 sends every click to your servers, so you add Redis in front, and the Redis counter needs persistence and a replica so a restart never hands out old IDs.",
    explainSimply: "A URL shortener stores pairs: a short code and the long link it stands for. Each new link takes the next number from a counter, written in a 62-character alphabet so it stays short. When someone clicks, the server looks up the code and sends the browser on to the long link.",
    hint: "Think about what happens on each insert with each method: does it need to check for a clash first?",
  },
  // High-Level Design Case Studies
  "case-study-method": {
    breaks: "Without a shared shape you read every case study from scratch, cannot compare two designs, and in an interview you narrate boxes in whatever order they come to mind.",
    tradeoffs: "A fixed template can feel mechanical, so each case study names the two or three sections where the real difficulty lives and spends its deep dives there.",
    explainSimply: "Every design write-up here uses the same chapter list, the way every recipe lists ingredients before steps. Once you know the chapters you can skip the routine ones and slow down at the hard bits. The chapter order is also the order you would talk in an interview.",
    hint: "Think about what each step needs from the step before it: you cannot size servers before you know the traffic, or pick a database before you know the data.",
  },
  "design-pastebin": {
    breaks: "Putting 180 TB of text bodies in the metadata database makes every backup, replica and vacuum pay for blobs it never queries, and trusting deletion to enforce expiry serves expired pastes from caches and edges for days.",
    tradeoffs: "Two stores can disagree, so the design needs an orphan sweep, an upload path that confirms the body exists before the row goes live, and an unlisted-paste read path that cannot use the CDN.",
    explainSimply: "A pastebin is a left-luggage office. The desk keeps a small ledger of tags and expiry dates, the bags sit on cheap shelves in the back room, and the clerk checks the date before handing a bag over. Popular bags get copied to kiosks around town so the desk is never the queue.",
    hint: "Multiply pastes per day by bytes per paste by days of retention, then compare that with the metadata, and ask which store is built for each.",
  },
  "design-rate-limiter": {
    breaks: "Without shared, atomically updated counters, each gateway instance enforces its own approximate share, two instances can both spend the last token, and a slow or dead counter store either adds tens of milliseconds to every request or takes the whole API down.",
    tradeoffs: "Every request now pays an in-region Redis round trip, accuracy is traded for throughput through local buckets and batching, and rule propagation, canaries and fail-open policy become an operational surface the platform team must own.",
    explainSimply: "Several doormen at different doors of one venue need to share a single head count. They radio a central tally before letting each guest in, turn away anyone obviously over the limit without radioing, and if the radio breaks they count at their own doors for a while instead of locking everyone out.",
    hint: "Think about who updates the counter, how many of them there are, how far away the counter is, and what you would rather do when you cannot reach it.",
  },
  "design-notification-system": {
    breaks: "Calling providers synchronously from the API collapses at a 100× campaign spike, one shared queue puts one-time passwords behind coupons, and at-least-once redelivery sends the same text twice.",
    tradeoffs: "Everything after ingestion is asynchronous and eventually consistent, so the design carries three layers of idempotency, a pacer per provider, a reconciler that polls for stuck statuses, and queues that hold minutes of backlog by design.",
    explainSimply: "Think of a post office sorting floor: sacks of letters come in, get sorted into express and bulk bins for each destination, and leave on trucks that carry a fixed load an hour. Express always boards first, every letter is stamped so it cannot be sent twice, and undeliverable mail goes to a returns shelf instead of being thrown away.",
    hint: "Compare the arrival rate during a campaign with the rate each provider accepts, then ask what sits between them and how urgent work overtakes bulk.",
  },
  "design-key-value-store": {
    breaks: "A single primary refuses every write the moment it is unreachable, and sharding by hash modulo moves almost every key each time a node is added, so neither availability nor incremental growth is possible.",
    tradeoffs: "Staying writeable through a partition means two versions of a key can exist, so the application must merge siblings, deletes become tombstones that cost disk for days, and background hints, read repair and Merkle-tree repair add traffic.",
    explainSimply: "Imagine three flatmates each keeping a copy of the shopping list, where a change counts once two copies have it. If one flatmate is away you leave a sticky note on their door and copy it in when they return. If two people changed the list at the same time, you keep both lists and sort it out together rather than throwing one away.",
    hint: "Draw the key's three home replicas, cut one off, and ask who can still acknowledge a write and what the version vectors look like afterwards.",
  },
  "design-file-storage": {
    breaks: "Whole-file uploads through application servers double the bandwidth bill, cannot resume or deduplicate, and a crash between writing the bytes and writing the metadata leaves files that point at nothing.",
    tradeoffs: "Chunking adds a block index with a hundred million new rows a day, devices must keep cursors and merge conflicts themselves, and the database and object store can only be kept honest by an ordering rule plus a background reconciler.",
    explainSimply: "Think of a file as a recipe listing numbered ingredients kept in a warehouse. If the warehouse already has an ingredient nobody sends it again, a delivery that stops halfway only resumes the missing ones, and the recipe card is only written once every ingredient is on the shelf. Every night someone checks that no recipe mentions an ingredient the warehouse does not have.",
    hint: "Think about what the client sends first, the hashes or the bytes, and what the server can therefore refuse to write.",
  },
  "design-instagram": {
    breaks: "Building each feed by reading 200 followees' posts on every open costs 50M reads a second, pushing every post to every follower lets one celebrity post block the fan-out tier for minutes, and 3,000 likes a second on one row serialize on a lock.",
    tradeoffs: "Fan-out on write spends 2M writes a second and terabytes of RAM to make reads cheap, a follower threshold adds a merge step on every feed read, and Redis counters make like counts approximate for a few seconds.",
    explainSimply: "Deliver every newspaper to subscribers' doors before dawn, except the national dailies, which readers pick up at the newsstand on their way, because one national paper would need a delivery fleet of its own. Photos travel a separate road through warehouses near the readers. Likes are tallied on a notepad and copied into the ledger every few seconds.",
    hint: "Compare the cost of pushing one post to its followers with the cost of 250,000 feed reads each pulling from 200 accounts, then ask which account breaks the average.",
  },
  "design-whatsapp": {
    breaks: "Pushing a message straight to a live connection loses it the moment a gateway dies after the sender saw a tick, and a per-recipient delivery table for 1,024-member groups collapses under eleven million deliveries a second.",
    tradeoffs: "Writing every delivery to an inbox before pushing it costs hundreds of terabytes of short-lived writes a day, and end-to-end encryption forbids server-side search, link previews and cloud recovery of chats.",
    explainSimply: "Think of a post office that only handles sealed envelopes. Every letter goes into the addressee's pigeonhole before anyone tries to hand it over, so nothing is lost if the courier trips. The clerk cannot read the letters, so there is no search desk, only \"give me everything in my pigeonhole, in order\".",
    hint: "Ask where a message lives between the sender's tick and the recipient's ack, and whose device counts the receipts in a group.",
  },
  "design-youtube": {
    breaks: "Pushing bytes through application servers and counting views with row updates collapses the first time a million people watch one video at once, and a single bitrate stalls every viewer on a weak network.",
    tradeoffs: "Pre-transcoding a full ladder costs hundreds of thousands of cores and a storage multiplier for videos nobody may watch, and the counts viewers see are minutes stale and may later be revised.",
    explainSimply: "Think of a bakery that bakes each video once into six loaves of different richness, all sliced at the same marks. Corner shops everywhere keep copies of the slices, so the bakery hardly hears from customers. When your arms get tired you switch to a lighter loaf at the next slice.",
    hint: "Ask what property of a segment lets thousands of caches serve it without asking anyone, and who decides which quality comes next.",
  },
  "design-uber": {
    breaks: "Writing every driver position to a database drowns it in a quarter of a million writes a second that are obsolete in four seconds, and matching without a conditional transaction sends two cars to one rider the first time a dispatcher retries.",
    tradeoffs: "Keeping positions only in memory means a crashed index node forgets a city for a few seconds, sharding trips and drivers by city makes cross-city trips a special case, and offering one driver at a time makes riders wait through declines.",
    explainSimply: "Picture a taxi rank with a whiteboard and a ledger. Drivers shout where they are and the dispatcher scribbles it on the whiteboard, wiping old scribbles as new shouts arrive. When a fare comes in, the dispatcher radios one driver at a time, and only when one says yes writes the fare in the ledger, in ink, against that driver.",
    hint: "Ask which data can be regenerated in four seconds and which data is money, and which shard key lets the trip and the driver change together.",
  },
  "design-netflix": {
    breaks: "Serving a country's prime-time peak from cloud egress or a pull-through CDN pays transit prices for hundreds of terabits a second and makes the first viewer at every edge wait on the origin, while a single-region control plane turns one cloud outage into a dead play button.",
    tradeoffs: "Owning appliances inside a thousand ISPs costs capital, hardware refreshes and a nightly placement forecast whose every error is transit bought at prime time, and three active-active regions each sized for half the peak leave a third of the control plane idle.",
    explainSimply: "Think of a cinema chain that drives tonight's film reels to every cinema the night before, so that at showtime no lorry is on the motorway. The head office only checks your membership card and tells you which screen to go to. If the head office in one city burns down, the one in the next city already has your card on file.",
    hint: "Ask which half of the system knows tomorrow's demand today, and what that lets you do with the bytes before anyone asks for them.",
  },
  "design-ecommerce": {
    breaks: "Checking stock, charging the card and confirming the order as independent writes lets a crash between them oversell, double-charge or lose a paid order, and a flash sale pointed at one inventory row melts the database for everyone.",
    tradeoffs: "Separate services with separate consistency rules mean a saga with compensations instead of one transaction, holds that block real buyers for their TTL, a reconciler for lost webhooks and a cache that may say in stock a few seconds too long.",
    explainSimply: "Picture a shop that hands out numbered tokens at the door for the one item everyone wants and only takes money from token holders, so nobody pays for a phone that is not there; an unused token goes back in the bowl after ten minutes. The shelves may carry an old price sticker for a minute, but the till rings the real one. If the card machine prints a receipt twice, the shop looks up the receipt number and charges you once.",
    hint: "Ask where the single contested number lives, who is allowed to touch it, and what makes a repeated request look identical to the first.",
  },
  "design-ticket-booking": {
    breaks: "Two fans read seat E7 as free in the same millisecond and both are told to pay, or a sale lets 200,000 people hammer the database for 2,000 holds and every show on the platform slows down.",
    tradeoffs: "Holds take seats off the market for ten minutes while carts are abandoned, the seat map is deliberately a second stale, fans wait in a queue even when the site is idle elsewhere, and the write path refuses holds during a database failover rather than risk two owners.",
    explainSimply: "A cloakroom has one attendant and a board of numbered hooks. Everyone in the hall can see the board, a steward lets people in a few at a time, and only the attendant hangs coats, one at a time. If you have not paid for your hook within ten minutes, the coat comes back off.",
    hint: "Separate the three crowds: who looks at the map, who is let in, and who is allowed to write a seat row, then ask which one the database must serve.",
  },
  "design-payment-system": {
    breaks: "Without idempotent attempts and a ledger, a timeout followed by a retry charges a customer twice, a crash between the PSP's answer and our database loses a payment, and a mutable balance column cannot say where the missing ₹24 went.",
    tradeoffs: "Every PSP call costs a committed row before and after, payments sit in a pending state instead of failing fast, the ledger grows forever and is never edited, and a daily reconciliation job and an exceptions queue become permanent parts of the system.",
    explainSimply: "You write a cheque and cannot remember whether you dropped it in the postbox. You do not write a second cheque; you keep the stub, ask the bank using the cheque number, and wait for the statement if you must. The payment system keeps a stub for every call it makes and reads the statement every day.",
    hint: "Ask what you can know for certain right after a timeout, what you wrote down before the call, and who can tell you later what really happened.",
  },
  "design-search-autocomplete": {
    breaks: "Ranking suggestions by querying a database or scanning a sorted list on every keystroke blows the ten-millisecond budget for short prefixes, and rebuilding rankings per request cannot keep up with thirty thousand lookups a second.",
    tradeoffs: "A precomputed index costs about 80 bytes for every prefix anyone types and only changes at the next build, a 60-second edge cache delays every ranking change, anything personalised cannot be cached at the edge, and typo tolerance costs a dozen extra lookups per keystroke.",
    explainSimply: "A librarian keeps a card for every opening phrase they hear, with the ten most-asked titles on it, and answers from the card instead of searching the shelves. The cards are rewritten each night from the day's requests, and a sticker goes on when everyone suddenly asks about the same thing.",
    hint: "Ask what work can be done before anyone types, what must be done the instant they type, and what must be done the moment someone reports a bad suggestion.",
  },
};
