import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-key-value-store",
  title: "Design a distributed key-value store",
  track: "hld",
  level: "advanced",
  minutes: 50,
  scenario: "Design a distributed key-value store in the style of Dynamo or Cassandra, used for shopping carts and sessions. It holds 100M keys with values of about 10 KB, serves 100k reads and 20k writes a second, and must keep accepting writes when replicas are down or the network splits.",
  focus: "About 800k replica operations a second at peak against only 3 TB of replicated data: throughput and tail latency size the cluster (about 40 nodes), and 'always writeable' shapes the replication design.",
  concepts: ["sharding", "cap", "quorums", "time-and-ordering", "btree-vs-lsm", "partitioning-internals"],
  steps: [
    {
      prompt: "What operations does the store expose, and which one non-functional requirement drives most of the design for carts and sessions?",
      hint: "For a shopping cart, which costs more: refusing a write while a replica is down, or merging two versions later? What should a read return if the store cannot tell which version is newer?",
      insight: "The store offers get, put and delete on keys up to 1 KB and values up to 1 MB, with consistency chosen per request; range scans, secondary indexes and multi-key transactions are out. 'Always writeable' drives everything: a put is never refused because a replica is down, so a get may return several sibling values plus an opaque context. Add p99 under 10 ms, three copies before success, adding nodes without downtime, and no special node.",
    },
    {
      prompt: "With N = 3, R = 2, W = 2, 100k reads and 20k writes a second and peaks of three times the average, what sizes the cluster: storage or throughput?",
      hint: "Multiply client operations by the replicas each one touches, then apply the peak. Assume one node handles about 20k operations a second, and compare with the size of the replicated data.",
      insight: "Replica operations are 200k reads plus 60k writes, about 800k a second at peak, so roughly 40 nodes, while 3 TB would fit on three machines. Throughput and tail latency size this cluster, and every key is rewritten about 17 times a day, so the engine's write path and compaction matter more than capacity.",
    },
    {
      prompt: "How should get and put carry versions so the store can tell an update from a concurrent write, and how is a delete represented?",
      hint: "Timestamps from different machines cannot be trusted to order writes. What could the client hand back on its next put to say which version it saw? What happens to a delete on a replica that was down?",
      insight: "Each version carries a version vector; get returns every concurrent version with an opaque context, a put that carries that context replaces what it read, and a put without it creates a sibling for the next reader to merge. A delete is a tombstone, a version with an empty value, so it replicates and repairs like any other write.",
    },
    {
      prompt: "How do you spread keys over 40 identical nodes so that a 41st can join without moving most of the data, and how does every node learn who owns what?",
      hint: "Compare hash(key) mod N with a ring. How many slices should each node own, how fast should a newcomer receive its data, and what would a central registry cost you?",
      insight: "Use consistent hashing with virtual nodes: each node owns 16 tokens, so a newcomer takes about 1/41 of the data from many nodes, streamed under a throttle while writes for moving ranges go to both old and new owners. Membership spreads by gossip with a phi-accrual failure detector, so every node holds the whole ring, routes any key in zero hops, and there is no master to fail.",
    },
    {
      prompt: "The link between two racks fails while customers on both sides keep updating the same cart. What happens to their writes, and what does the next reader see after the link heals?",
      hint: "A strict quorum would refuse one side. What can a coordinator do with a write when a home replica is unreachable? After the heal, how does the store notice that two versions conflict, and who resolves them?",
      insight: "A sloppy quorum writes to the next healthy node with a hint for the missing replica, so both sides succeed; on heal the hint is handed off, and read repair plus Merkle-tree anti-entropy spread both versions. The first quorum read sees two version vectors where neither dominates and returns both, and the application merges the cart by union, whereas last-write-wins would silently drop one customer's items.",
    },
    {
      prompt: "Pick N, R, W and a conflict rule for shopping carts, session tokens and feature flags. Is any of them strongly consistent?",
      hint: "R + W > N makes a read overlap the last acknowledged write. Ask which data can be merged, which only needs the latest value, and which is read far more often than it is written.",
      insight: "Carts use (3, 2, 2) with version vectors and siblings merged by union, sessions (3, 1, 1) with last-write-wins, and flags (3, 3, 1), since a stalled write is acceptable but a stale read is not. None is strictly linearizable, because sloppy quorums and concurrent writes can still surprise a reader; callers that need one agreed order need consensus and must accept that a minority partition stops answering.",
    },
    {
      prompt: "A key is deleted while one of its replicas is down. Why might the old value come back, and how do you stop it?",
      hint: "SSTables are immutable, and repair copies whatever a replica holds. What must the delete leave behind, and for how long?",
      insight: "If the reachable replicas simply drop the key, read repair or anti-entropy later copies the old value back from the replica that missed the delete, a zombie. So the tombstone is written to W replicas and kept for gc_grace_seconds (ten days by default in Cassandra) before a compaction covering every older SSTable may drop it, and a node down for longer is rebuilt rather than rejoined; a delete storm is therefore a write storm with a long tail.",
    },
  ],
  tradeoffs: [
    "Leaderless ring vs Raft-replicated shards: choose leaderless when the application can merge two versions, as a cart can, because any node then takes any write during a partition; choose consensus when it cannot, as with a bank balance, and accept that the minority side stops.",
    "Sloppy quorum vs strict quorum: sloppy keeps writes flowing during a partition at the cost of a merge later; strict returns 503 on the minority side, which the always-writeable requirement forbids.",
    "Version vectors vs last-write-wins: version vectors detect concurrent writes and return siblings; last-write-wins is fine for sessions but silently loses cart items and depends on clocks agreeing.",
    "Size-tiered vs leveled compaction: size-tiered keeps write cost lowest for a heavy rewrite stream; leveled reads fewer files and wastes less disk at the price of more rewriting.",
  ],
  followUps: [
    "What happens to a hinted write if the stand-in node dies before it can hand the write off?",
    "Some clients put without reading first. What goes wrong over time?",
    "One key receives a huge share of traffic. Why does adding nodes not help, and what does?",
    "How would you add a second data centre without making requests wait on the inter-site link?",
  ],
};
