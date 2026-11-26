import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 8: Database Internals, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Database Internals
  "storage-engines": {
    breaks: "Without pages and a buffer pool every row lookup is a random disk read, and without the right row or column layout an analytics scan drags whole rows through memory to use three columns.",
    tradeoffs: "Fixed pages waste space and amplify small writes, RAM spent on the buffer pool is RAM taken from everything else, and a column store's fast scans come with slow single-row updates.",
    explainSimply: "A database keeps its data in fixed-size pages, like a warehouse that only moves whole pallets. Asking for one item still brings a pallet, so the database parks the most-used pallets by the door, which is the buffer pool. Row stores pack each order on one pallet; column stores pack all the prices together, which is better for reports.",
    hint: "Think about what the disk actually moves, and where recently used pages wait.",
  },
  "wal": {
    breaks: "Without a log the engine must write every dirty page at commit, which is slow and still leaves half-written pages after a crash; without checkpoints the log grows unbounded and recovery replays all of it.",
    tradeoffs: "Every commit pays for a disk flush, full-page images and logical detail inflate the log, and frequent checkpoints trade shorter recovery for extra I/O.",
    explainSimply: "Before changing anything on disk, the database writes a one-line note describing the change in a diary, then confirms your transaction. If the power fails, it reads the diary and redoes what was lost. Every so often it tidies up and marks a page in the diary as the new starting point.",
    hint: "Think about what gets flushed at commit, what gets written later, and where replay starts.",
  },
  "btree-vs-lsm": {
    breaks: "Pick a B-tree for a firehose of writes and random page rewrites saturate the disk; pick an LSM tree for a latency-sensitive read workload without tuning compaction and reads wander across many files while stalls appear at peak write load.",
    tradeoffs: "Every engine pays in some mix of read, write and space amplification: B-trees pay on writes, size-tiered LSM pays in space and reads, leveled LSM pays by rewriting data at every level.",
    explainSimply: "A B-tree is a filing cabinet: each change goes straight into its folder, so finding things is quick but filing is slow when folders fill up. An LSM tree is an inbox tray: everything lands on top instantly and gets sorted into bundles later. The tray is faster to fill; the cabinet is faster to search.",
    hint: "Ask whether the workload is dominated by writes or reads, then think about what keeps reads from checking every file.",
  },
  "mvcc-isolation": {
    breaks: "Without MVCC every reader waits for every writer on the same rows; with MVCC but without understanding write skew, check-then-act rules that span rows silently break under Repeatable Read.",
    tradeoffs: "Old versions consume space and must be vacuumed or purged, long transactions block that cleanup, and SERIALIZABLE buys correctness with aborts the application has to retry.",
    explainSimply: "The database keeps old copies of a row so that someone reading it never waits for someone changing it; each transaction reads a frozen snapshot, like that morning's newspaper edition. The catch is two people reading the same edition and each making a decision the other did not see. Serializable mode notices that and makes one of them redo their work.",
    hint: "Think about two transactions that read the same rows but write different ones, and about what happens to the rows nobody can see any more.",
  },
  "query-execution": {
    breaks: "Without a planner working from accurate statistics the database full-scans tables or loops an index lookup millions of times, and without reading the plan you optimise blind.",
    tradeoffs: "Every index speeds some reads and slows every write, covering indexes widen the index, and statistics are a sample, so estimates can be wrong exactly on the skewed data that matters.",
    explainSimply: "You tell the database what you want and a planner works out the route, like a satnav choosing between the motorway and side streets. EXPLAIN shows the route and how long each leg really took. If the satnav's map is out of date it picks a bad route, and refreshing the map (statistics) often fixes more than building new roads (indexes).",
    hint: "Compare what the planner expected with what actually happened, and look at how many times the inner loop ran.",
  },
  "replication-internals": {
    breaks: "Ship statements and non-deterministic functions make replicas diverge; recycle WAL a lagging replica still needs and it must be rebuilt; promote a standby without fencing the old primary and two servers accept conflicting writes.",
    tradeoffs: "Physical replication is exact but version-locked, logical replication is flexible but skips DDL and bloats on bulk changes, slots can fill disks, and synchronous commits buy zero loss with latency and availability risk.",
    explainSimply: "Keeping a copy of a database means sending every change somewhere else, and you can send the instruction, the exact bytes, or a plain description of what changed, like mailing a recipe, a frozen kitchen, or a shopping list. If the original fails, a copy takes over, and whatever had not arrived yet is lost. If two copies both accept changes, you need a rule for who wins.",
    hint: "Think about what was acknowledged but not yet sent, and about what crosses the wire in each style.",
  },
  "partitioning-internals": {
    breaks: "Without a plan for secondary indexes every non-key query hits all shards; without a rebalancing strategy adding a node moves most of the data; without routing clients cannot find a moved partition; and a hot key saturates one partition however many you have.",
    tradeoffs: "Global indexes trade write cost and consistency for cheap reads, fixed partition counts trade flexibility for simplicity, dynamic splitting adds hot starts and background movement, and salting multiplies read work to spread writes.",
    explainSimply: "Once data is spread over many machines, new questions appear: how to find things by something other than the filing key, how to add a machine without re-filing everything, and how a request knows which machine to ask. Think of library branches: you can phone every branch, keep a central catalogue that lags a little, hand a new branch whole shelves, and spread one wildly popular book over many branches on purpose.",
    hint: "Think about where the index for a non-key attribute lives, and what a query has to do when it is not where the data is.",
  },
  "distributed-sql": {
    breaks: "A single primary caps write throughput and loses acknowledged writes on failover, while hand-sharding behind a router leaves cross-shard transactions, unique constraints and joins to the application.",
    tradeoffs: "Every write waits for a consensus majority, so latency rises with the distance between replicas, sequential keys create hot ranges, and the cluster needs far more operational care than one server.",
    explainSimply: "Imagine a ledger copied to three towns, where a sale only counts once two of the three clerks have initialled it and a town-hall clock stamps the order of entries. Nothing is lost if one town burns down, but every sale takes a little longer. That is distributed SQL.",
    hint: "Think about what replaces the primary, and what every write has to wait for.",
  },
};
