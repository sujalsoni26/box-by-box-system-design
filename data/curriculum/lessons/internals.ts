import type { LessonMeta } from "@/types/curriculum";

/** Module 8: Database Internals. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/internals.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "storage-engines", title: "How a database stores data", moduleId: "internals", level: "intermediate", minutes: 12,
    problem: "A query that touches one 100-byte row still reads whole pages from disk, and the wrong layout or engine turns a simple report into a full-table crawl.",
    summary: "A storage engine moves fixed-size pages between disk and a buffer pool. Row stores suit transactions, column stores suit analytics, and MySQL, MongoDB and RocksDB show that the engine is a swappable part beneath the query layer.",
    catTip: "I never fetch one kibble; I knock the whole bowl over. Databases are the same: ask for one row and a whole 8 kB page comes along. Keep the bowls you use most in the warm spot by the server.",
    recall: { q: "Why does a database read pages rather than rows, and what does the buffer pool do about the cost?", a: "Disks and SSDs move fixed-size blocks, so engines store rows in fixed-size pages (8 kB in PostgreSQL by default) and read a whole page to get one row. The buffer pool caches pages in RAM so repeated reads of hot pages cost memory time instead of a disk read." },
    archNodes: [],
  },
  {
    slug: "wal", title: "Write-ahead logging and crash recovery", moduleId: "internals", level: "intermediate", minutes: 12,
    problem: "A crash between acknowledging a commit and writing the changed pages would lose or half-apply the transaction unless something durable records it first.",
    summary: "The write-ahead log records every change sequentially before data pages are touched, so a commit is one flush of the log. Checkpoints bound recovery, group commit amortises flushes, and the same log feeds replicas and change data capture.",
    catTip: "Before I nap on a new server I scratch a note on the wall: Cache was here, 14:02. If the humans move me mid-nap, the note survives. Databases scratch the log first and move the furniture later.",
    recall: { q: "After a crash, how does a database know which committed changes to reapply and how far back to look?", a: "It replays the write-ahead log from the last checkpoint, redoing records whose LSN is newer than the LSN stored on the page. Changes of uncommitted transactions are undone, or in PostgreSQL simply left invisible for vacuum to remove." },
    archNodes: ["db"],
  },
  {
    slug: "btree-vs-lsm", title: "B-trees vs LSM trees", moduleId: "internals", level: "advanced", minutes: 17,
    problem: "An engine that rewrites whole pages for every small change cannot keep up with a write-heavy stream, and one that appends everything cannot answer reads without visiting many files.",
    summary: "B-trees update fixed-size pages in place for predictable reads at the cost of random page writes; LSM trees append to a memtable, flush immutable SSTables and compact in the background, trading read and space amplification for sequential writes.",
    catTip: "A B-tree is my food cupboard: every tin in its labelled place, tidy but fussy to restock. An LSM tree is me shoving each new toy under the sofa and sorting the pile at midnight.",
    recall: { q: "A key-value store ingests 200,000 sensor writes per second and serves occasional point lookups. Which structure fits, and what makes the lookups tolerable?", a: "An LSM tree: writes are sequential appends to a memtable that is flushed as SSTables. Bloom filters on each SSTable let a point lookup skip files that cannot hold the key, so reads touch few files despite the many levels." },
    archNodes: ["db"],
  },
  {
    slug: "mvcc-isolation", title: "MVCC and isolation levels", moduleId: "internals", level: "advanced", minutes: 16,
    problem: "Two transactions each check a rule, each write a different row, and both commit, leaving the database in a state neither of them would have allowed.",
    summary: "MVCC keeps several versions of a row so readers never block writers, and each transaction reads a snapshot. Snapshot isolation still permits write skew, which serializable snapshot isolation or explicit locks prevent, and old versions must be vacuumed or purged.",
    catTip: "Two humans each check the bowl, each see food, each decide the other will refill it. That is snapshot isolation in my own kitchen. Serializable would make one of them wait or retry, and I would eat.",
    recall: { q: "Two on-call doctors each check that at least two are rostered, then each remove themselves; both commit and nobody is on call. Name the anomaly and two ways to prevent it.", a: "Write skew: disjoint writes after reading overlapping data, which snapshot isolation allows. Prevent it with SERIALIZABLE (serializable snapshot isolation, retrying on SQLSTATE 40001) or by locking the rows the decision depends on with SELECT FOR UPDATE." },
    archNodes: [],
  },
  {
    slug: "query-execution", title: "Indexes and query execution", moduleId: "internals", level: "intermediate", minutes: 14,
    problem: "A query that should touch twenty rows reads the whole table, or the app fires one query per row, and nobody can tell which from the code alone.",
    summary: "The planner turns SQL into a tree of scans and joins using statistics; EXPLAIN ANALYZE shows estimated against actual rows. Covering indexes enable index-only scans, selectivity decides when an index helps, and N+1 lives outside the planner's reach.",
    catTip: "Before I pounce I check the floor plan: shortest path to the bowl, not the longest. EXPLAIN is the floor plan the database drew; if its guess of where the mice are is wrong, so is the route.",
    recall: { q: "EXPLAIN ANALYZE shows a nested loop whose inner index scan has loops=50000, while the outer node estimated 20 rows and produced 50,000. What went wrong and what do you do first?", a: "The planner's row estimate was far too low, usually from stale statistics or correlated columns, so it chose a nested loop that ran 50,000 times. Run ANALYZE, consider extended statistics on the correlated columns, and recheck the plan before adding indexes." },
    archNodes: [],
  },
  {
    slug: "replication-internals", title: "Replication strategies in depth", moduleId: "internals", level: "advanced", minutes: 16,
    problem: "The primary dies with acknowledged commits still unsent, a forgotten replication slot fills the disk, or two regions update the same row and one write quietly disappears.",
    summary: "Replication ships statements, physical WAL or logical row changes, each with different limits. Slots keep lagging replicas fed, failover trades a data-loss window against commit latency, multi-leader setups need LWW, merges or CRDTs, and CDC turns the log into events.",
    catTip: "I follow the human from room to room by the sound of footsteps: that is physical replication, exact but same-house only. A note saying the bowl moved to the kitchen works in any house. That is logical.",
    recall: { q: "A primary with asynchronous standbys crashes. What exactly is lost, and which setting would have prevented it, at what cost?", a: "Every transaction the primary acknowledged after the promoted standby's last received WAL position: the data-loss window equals the replication lag. A non-empty synchronous_standby_names makes commits wait for standby confirmation, closing the window at the price of latency and of commits hanging if the standbys are down." },
    archNodes: ["db"],
  },
  {
    slug: "partitioning-internals", title: "Partitioning and rebalancing", moduleId: "internals", level: "advanced", minutes: 16,
    problem: "After sharding, a query by anything but the shard key fans out to every shard, adding a node reshuffles data, and one hot key still pins a single partition.",
    summary: "Local indexes make writes cheap and reads scatter-gather; global indexes invert that and go eventually consistent. Rebalance with fixed partitions, dynamic splits or per-node slices, route through a coordination service, gossip or a routing tier, and salt hot keys.",
    catTip: "Every room in the house has its own toy box, a local index: finding the red mouse means checking all of them. One master list of toys by colour is faster to read but always a little behind where I actually dropped it.",
    recall: { q: "A photo service partitioned by user needs all photos with a given tag. Compare a local and a global secondary index for that query.", a: "A local index lives with each user partition, so the tag query scatter-gathers across every partition and waits for the slowest. A global index is partitioned by tag, so the query hits one partition, but each write also updates a second partition asynchronously and reads from the index are eventually consistent." },
    archNodes: ["db"],
  },
  {
    slug: "distributed-sql", title: "Distributed SQL and NewSQL", moduleId: "internals", level: "advanced", minutes: 17,
    problem: "One PostgreSQL primary has run out of write capacity and disk, and sharding it by hand would break the transactions and joins the product depends on.",
    summary: "Distributed SQL databases such as Spanner, CockroachDB and TiDB split tables into key ranges, replicate each range with Raft or Paxos, run two-phase commit across ranges and order commits with a clock service, so one SQL endpoint survives node and region loss.",
    catTip: "I used to nap on one big database server. Now the humans spread my bed across three towns and only count me asleep once two of the three beds agree. Very safe. Also slower to lie down, every single time.",
    recall: { q: "What does a distributed SQL database do that sharded PostgreSQL cannot, and what does every write pay for it?", a: "It splits tables into ranges it moves itself, replicates each range with Raft or Paxos, and runs two-phase commit across ranges so cross-shard transactions are ordinary. Every write pays at least one consensus round trip, which across regions is the round trip to the nearest other region." },
    archNodes: ["db"],
  },
];
