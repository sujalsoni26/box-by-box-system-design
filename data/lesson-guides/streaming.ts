import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 9: Messaging and Streaming, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Messaging and Streaming
  "kafka-architecture": {
    breaks: "A classic queue deletes each message once a consumer acks it, so a second consumer never sees the same events, nothing can be replayed after a bug, and ordering is lost on redelivery.",
    tradeoffs: "Keeping every record for days costs disk and moves the what-have-I-handled bookkeeping to each consumer, and strong durability (acks=all with min.insync.replicas=2) adds a wait for a second broker on every write.",
    explainSimply: "Kafka is a numbered ledger that is never erased: new entries go at the end, and each reader keeps a bookmark instead of tearing pages out. The ledger is copied to several machines so losing one loses nothing, and old volumes are shredded after a set time.",
    hint: "Think about who must hold the record before the leader says yes, and what 'everyone in sync' means when only the leader is in sync.",
  },
  "partitions-consumer-groups": {
    breaks: "Without a deliberately chosen key and a sized partition count, related events are processed out of order, consumers beyond the partition count sit idle, and one hot key stalls a single partition while the others are empty.",
    tradeoffs: "Ordering and parallelism pull against each other: a coarse key keeps order but concentrates load, a fine key spreads load but orders less, and changing the partition count later breaks the key-to-partition mapping.",
    explainSimply: "A topic is a row of checkout lanes and each consumer is a cashier who owns a lane. A shopper's items stay in one lane and are scanned in order, extra cashiers with no lane stand about, and one enormous trolley slows its lane however many cashiers you hire.",
    hint: "Count the partitions, then ask what each partition's lag looks like and what happens to a key's partition when you add more.",
  },
  "delivery-semantics": {
    breaks: "Retries after lost acknowledgements and restarts after crashes replay work, so without idempotence or transactions a payment is taken twice, or, if offsets are committed early, a record is silently skipped.",
    tradeoffs: "Every stronger guarantee costs something: idempotence needs state to remember what was seen, transactions add coordinator round trips and hold readers at the last stable offset, and effectively-once needs every sink to cooperate.",
    explainSimply: "Delivering a message is like a chore list and a pen: tick before doing and you may skip one, tick after and you may do one twice, and no pen trick gives you exactly once. The only way out is making the repeat harmless, like noticing the bin is already empty.",
    hint: "Where was the offset when the crash happened, and what would make the second attempt a no-op?",
  },
  "cdc": {
    breaks: "Publishing an event from application code after the commit can lose it when the process dies in the gap, and polling tables for changes misses deletes and out-of-order commits.",
    tradeoffs: "Consumers must tolerate duplicates and apply changes idempotently, a replication slot holds WAL until it is read, and schema changes need discipline because consumers see every column change.",
    explainSimply: "Instead of asking the database what changed, you read its diary: every change it committed, in order, including the things it threw away. Anyone who needs to know, the cache, the search index or the warehouse, reads the diary at their own pace. Nothing is missed because the diary is written before anything else happens.",
    hint: "Think about what happens between a commit and a publish, and where the event could be written instead.",
  },
  "brokers-compared": {
    breaks: "A queue used as an event bus copies every event into every consumer's queue and can never replay, while a log used as a work queue gives head-of-line blocking per partition and no per-message retry.",
    tradeoffs: "Logs give replay and fan-out but order only per partition and offer no per-message routing; queues route and retry each message but delete it on acknowledgement; managed services remove operations at the price of regional throughput ceilings.",
    explainSimply: "A log is a newspaper archive: every issue stays on the shelf and any reader can start from any date. A queue is a post office: each letter goes to one carrier and is gone once signed for. Pick the archive when many people need the same history, the post office when each item is an errand for one person.",
    hint: "Think about who else needs the same message, and whether anyone will ever ask for it again.",
  },
  "stream-processing": {
    breaks: "Windowing by arrival time misplaces delayed events, closing windows too early drops stragglers, and a crash without checkpoints loses every count, session and join buffer the job had built up.",
    tradeoffs: "Waiting longer for late data gives more complete results at higher latency, checkpointing costs snapshot time and barrier alignment, and exactly-once sinks need transactions or idempotent writes that slow the pipeline.",
    explainSimply: "A stream processor is a clerk counting letters by postmark, not by the day they land in the letterbox. At some point the clerk says the Tuesday pile is closed, which is a guess, and keeps a saved copy of the tallies so a dropped ledger does not mean starting from zero.",
    hint: "Separate when it happened from when you saw it, then ask how the job decides a minute is finished and what it saves in case it crashes.",
  },
  "eda-patterns": {
    breaks: "Without agreed event shapes and compatibility rules, consumers break on old records, services issue commands disguised as events and wait for reactions nobody owes them, and the workflow exists only in a running system that nobody can read.",
    tradeoffs: "Fat events trade copies and eventual consistency for consumer autonomy, strict compatibility trades flexibility for safe replay, and an orchestrator trades the loose coupling of choreography for a visible workflow and one more component that can bottleneck.",
    explainSimply: "An event is a notice pinned to the company board: it says what happened, anyone may read it, and each department decides what to do. A command is a memo to one person asking for something. Keep old notices readable, and when the flow matters, appoint someone to run it.",
    hint: "Is the message a fact or a request, who must still read last week's copy of it, and who owns the flow when a step stalls?",
  },
};
