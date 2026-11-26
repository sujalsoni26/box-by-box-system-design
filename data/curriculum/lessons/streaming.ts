import type { LessonMeta } from "@/types/curriculum";

/** Module 9: Messaging and Streaming. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/streaming.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "kafka-architecture", title: "Kafka: a distributed log", moduleId: "streaming", level: "intermediate", minutes: 16,
    problem: "A queue deletes each message once one worker acks it, so a second team cannot read the same events later and nothing can be replayed after a bug.",
    summary: "Kafka is a partitioned, replicated, append-only log. Producers append to partition leaders, followers copy the records, consumers read by offset and keep their own position, and records stay for a retention period or are compacted down to the latest value per key.",
    catTip: "I nap on the broker because it never throws anything away: every record stays, in order, until retention says otherwise. I keep my own bookmark, called an offset, and if I oversleep for a week the log has moved on without me.",
    recall: { q: "A producer sends with acks=all. What does it actually wait for, and why does min.insync.replicas still matter?", a: "The leader acknowledges only after every replica in the in-sync replica set (ISR) has the record. If the ISR has shrunk to the leader alone that is a single copy, so min.insync.replicas (typically 2 with replication factor 3) makes the broker refuse the write with NotEnoughReplicas instead of accepting it on one broker." },
    archNodes: ["queue"],
  },
  {
    slug: "partitions-consumer-groups", title: "Partitions, consumer groups and ordering", moduleId: "streaming", level: "intermediate", minutes: 14,
    problem: "Ten consumers are started for a topic with four partitions and six do nothing, while one partition carrying a single hot key falls further behind every minute.",
    summary: "A partition is the unit of both ordering and parallelism. Keys decide which partition a record joins, a consumer group gives each partition exactly one owner, rebalances move partitions when membership changes, and lag per partition tells you whether the group keeps up.",
    catTip: "I pick one checkout lane and stay in it, so my tins are scanned in the order I put them down. The empty lane next to me does not help: a partition has one owner, and a hot key is one very full trolley.",
    recall: { q: "A topic has 8 partitions and its consumer group has 12 instances. How many do useful work, and what would you check before adding partitions?", a: "At most 8, because each partition has exactly one owner within a group, so 4 instances idle. Check whether lag is spread evenly or sits on one hot partition, and remember that adding partitions changes which partition each key hashes to, so per-key order breaks across the change." },
    archNodes: ["queue"],
  },
  {
    slug: "delivery-semantics", title: "Delivery semantics and exactly-once", moduleId: "streaming", level: "advanced", minutes: 14,
    problem: "A consumer inserted five payments, crashed before committing its offset, restarted and inserted the same five again; the retry nobody saw became a double charge.",
    summary: "At-most-once, at-least-once and exactly-once follow from whether retries can duplicate and whether a consumer commits before or after the work. Kafka adds an idempotent producer and transactions inside the log; outside it, exactly-once is an effect you get only from idempotent sinks.",
    catTip: "I tick my chore list after I do the chore, so a nap in between means doing it twice. Fine for naps, bad for payments. The trick is making the second go change nothing, which is a plan, not a hope.",
    recall: { q: "A consumer commits its offset after processing a batch and crashes between the two steps. What happens on restart, and what makes it harmless?", a: "It re-reads the batch from the last committed offset and processes it again: at-least-once. It is harmless only if the processing is idempotent, through an event id or natural key that the sink checks, or if the offset was stored in the same transaction as the output so the restart can skip what was done." },
    archNodes: [],
  },
  {
    slug: "cdc", title: "Change data capture", moduleId: "streaming", level: "intermediate", minutes: 14,
    problem: "The order service writes the row and then publishes the event, crashes in between, and the cache, search index and warehouse never learn the order exists.",
    summary: "Change data capture reads committed changes from the database log and publishes each as an event in commit order. With an outbox table it makes the row and its event one atomic write, delivered at least once and ordered per key.",
    catTip: "I do not ask the humans what changed in the kitchen. I read the scratches on the cupboard door, in order, including the tin that was taken away. The log never forgets a delete, and neither do I.",
    recall: { q: "Why does log-based CDC with an outbox beat writing to the database and then publishing to Kafka?", a: "A dual write can commit the row and lose the event when the process dies between them. With an outbox the event is written in the same transaction as the row, and Debezium reads both from the WAL, so nothing committed can be missing its event and the stream is in commit order." },
    archNodes: ["db", "queue", "cache"],
  },
  {
    slug: "brokers-compared", title: "Choosing a broker", moduleId: "streaming", level: "intermediate", minutes: 16,
    problem: "Billing, analytics and a new fraud model all need the order events, one of them wants last month's replayed, and the team put everything on one work queue.",
    summary: "Brokers are logs or queues underneath. Kafka and Pulsar keep records and let readers replay; RabbitMQ and SQS route, acknowledge and delete each message; SNS fans out. Replay and many readers want a log, per-message routing wants a queue.",
    catTip: "The newspaper archive lets me read any day I like, as often as I like. The post office hands each letter to one cat and it is gone. I pick the archive for history and the post office for errands. Never the other way round.",
    recall: { q: "What single question decides between a log broker and a queue broker?", a: "Whether more than one consumer needs the same events, or anyone will replay them: if so, a log such as Kafka. If each message is routed by content and consumed once by competing workers with per-message acks, a queue such as RabbitMQ or SQS, with SNS for fan-out." },
    archNodes: ["queue"],
  },
  {
    slug: "stream-processing", title: "Stream processing", moduleId: "streaming", level: "advanced", minutes: 16,
    problem: "A per-minute metric computed as events arrive shows zeros while phones are offline and a spike when they reconnect, and a crash loses every running count.",
    summary: "Stream processors compute continuously over unbounded data. Event time and watermarks decide when a window is complete, windows shape the metric, checkpoints make operator state survive failures, and stream-table joins enrich events with the right version of a row.",
    catTip: "I count mice per hour by when I caught them, not when I finally bring them in. A watermark is me deciding the hour is over; the mouse that turns up afterwards is late data, and I note it rather than pretend it never happened.",
    recall: { q: "A dashboard counts rides started per minute from phone events that can arrive minutes late. What do event time, a watermark and allowed lateness each contribute?", a: "Event time puts each ride in the minute it actually started rather than the minute it arrived. The watermark is the processor's estimate that no older events remain, which lets it close a window. Allowed lateness keeps a closed window updatable for a while so late events correct the count instead of being dropped." },
    archNodes: [],
  },
  {
    slug: "eda-patterns", title: "Event-driven architecture in practice", moduleId: "streaming", level: "intermediate", minutes: 12,
    problem: "Twelve services react to each other's events, nobody can say what happens after OrderPlaced, and a renamed field broke three consumers that were still reading last week's records.",
    summary: "Design events as past-tense facts with an owner, choose thin notifications or fat state-carrying events deliberately, evolve schemas through a registry with compatibility rules, and know when a choreographed flow needs an orchestrator and how to observe it.",
    catTip: "I do not command the humans; I publish MeowHeard and let them react. A fat meow tells them what I want, a thin meow makes them come and look. Either way, the shape of a meow must never change without warning.",
    recall: { q: "Five teams consume OrderPlaced and you want to rename customer_id to buyer_id. What does a registry in BACKWARD mode let through, and what should you do instead?", a: "A rename is a delete plus an add; BACKWARD allows deleting fields and adding optional ones, so the registry accepts it, but old records still carry customer_id and new-schema consumers read an empty buyer_id. Add buyer_id as optional, populate both for a while, and drop customer_id only after every consumer has moved." },
    archNodes: [],
  },
];
