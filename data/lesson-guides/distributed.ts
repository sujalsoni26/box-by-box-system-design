import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 7: Distributed Systems, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Distributed Systems
  "distributed-fundamentals": {
    breaks: "On one machine a call either returns or the process crashes; across a network a call can hang, succeed silently or hit a machine that is alive but unreachable, and code that assumes otherwise double-charges, deadlocks or declares healthy servers dead.",
    tradeoffs: "Every defence against an unreliable network, such as timeouts, retries, acknowledgements and replication, costs latency, duplicates or complexity, so you choose which failures to tolerate rather than eliminating them.",
    explainSimply: "A distributed system is several computers that can only talk by sending messages, and the messages behave like letters: they can be late, lost or arrive twice. Nobody has a master clock, and nobody can see whether a silent neighbour is dead or just slow. Designing for that uncertainty is what this whole track is about.",
    hint: "Think about what a missing reply tells you, then list everything it does not tell you.",
  },
  "time-and-ordering": {
    breaks: "Timestamps from different machines disagree by milliseconds or more, and a process paused by garbage collection wakes up trusting a stale clock, so systems that order writes or expire leases by wall-clock time silently lose data or run two leaders at once.",
    tradeoffs: "Logical clocks add metadata to every message and only give a partial order, while trusting physical time means paying for synchronised clock hardware and waiting out the remaining uncertainty on every commit, as Spanner does.",
    explainSimply: "Imagine friends in different cities keeping one shared diary, each using their own slightly wrong wristwatch. You cannot tell from the watch times who wrote first. If each friend numbers their entries and notes the highest number they have heard from the others, you can work out who knew what when, without trusting any watch.",
    hint: "Think about what a Lamport timestamp promises when a happens before b, and what it cannot promise in the other direction.",
  },
  "quorums": {
    breaks: "Without a rule for how many replicas must answer, a reader can hit the one copy that missed a write and return stale data, and two replicas that accepted different writes to the same key never discover that they disagree.",
    tradeoffs: "Larger quorums make reads fresher but slower and less available, hints and repair add background traffic, and version vectors push conflict merging onto the application instead of silently dropping a write.",
    explainSimply: "Imagine telling your dinner plan to any two of your three flatmates and later asking any two of them what it was. Someone you ask always heard the plan. But if you changed the plan twice through different flatmates at the same time, the two who answer may disagree, and you need a rule for which plan counts.",
    hint: "Draw three circles, shade the two that acknowledged the write and the two you read from, then ask what could break the overlap.",
  },
  "consensus": {
    breaks: "Without consensus two nodes can each believe they are the leader or hold different versions of the same log, so a partition turns into two diverging truths that nobody can merge afterwards.",
    tradeoffs: "Every committed write costs a round trip to a majority, a cluster of 2f + 1 nodes stops accepting writes when more than f fail, and elections cause short pauses, so consensus is reserved for small, critical metadata rather than bulk data.",
    explainSimply: "Picture a committee that only passes a motion when more than half its members sign it, with every meeting numbered. Two different motions can never both pass in one meeting, because someone would have had to sign both. A member who was out of the room sees the meeting number and knows to catch up before voting.",
    hint: "Count how many nodes two majorities of five must have in common, then ask who can win a vote without holding that node's log.",
  },
  "leader-election": {
    breaks: "Two processes that both believe they are the leader run the same job twice, write conflicting data or send duplicate payments, and the lease that was meant to prevent it cannot wake a paused process to tell it that it lost.",
    tradeoffs: "A short lease detects a dead leader quickly but causes needless failovers on every slow heartbeat, a long one leaves the job unattended, and fencing only works if every system the leader writes to is changed to check the token.",
    explainSimply: "Think of a library with one key to the archive, lent out for an hour at a time. If the borrower falls asleep and the key is reissued to someone else, the sleeper wakes up still believing the archive is theirs. The fix is a door that checks the latest key number instead of trusting whoever is holding a key.",
    hint: "Ask who can still tell the paused leader that it has lost, and notice that it is not the lease; it has to be whatever receives the writes.",
  },
  "distributed-locks": {
    breaks: "A lock key with a TTL expires while its holder is paused or slow, a second worker takes the lock and both write to the same resource; a plain DEL on release can also remove a lock that now belongs to someone else.",
    tradeoffs: "Every distributed lock is a lease, so you pay either for a consensus round trip plus a fencing check on the resource, or you accept that under pauses and clock shifts two holders can briefly overlap.",
    explainSimply: "A distributed lock is a hotel key card that expires at check-out, so a room is never stuck forever if a guest disappears. The catch is that an oversleeping guest does not notice the card has expired, and the next guest is let in while they are still inside. A safe system has the room itself check whose turn it is.",
    hint: "Think about what the holder knows at the moment its lease expires, and who else could do the checking.",
  },
  "distributed-transactions": {
    breaks: "Without an atomic commit protocol a change across two databases can commit on one side and fail on the other, and the committed side is durable and cannot be undone.",
    tradeoffs: "Participants hold locks from prepare until the decision arrives, the slowest participant sets everyone's latency, and a coordinator crash leaves them blocked in doubt unless the coordinator's log is replicated with consensus.",
    explainSimply: "Two-phase commit is a wedding: the officiant asks each person 'do you?' and only after both say 'I do' declares them married. Having said 'I do', neither can walk away until the declaration is made. If the officiant faints in between, everyone stands at the altar waiting.",
    hint: "Think about what each participant has promised, and where the only copy of the decision lives.",
  },
  "sagas": {
    breaks: "A business transaction that spans several services cannot be rolled back once one service has committed, so a failure half-way leaves reserved stock, taken payments or half-created orders behind.",
    tradeoffs: "You give up isolation and atomic rollback: other transactions see intermediate states, every step and compensation must be idempotent, and some actions can only be compensated semantically rather than undone.",
    explainSimply: "A saga is how you book a trip across several companies: flight, then hotel, then taxi, each a separate booking. If the hotel is full you do not rewind time; you cancel the flight and accept the fee. Each booking has a matching cancellation, and the trip ends either fully booked or fully cancelled.",
    hint: "Think about what a cancellation does that a rewind would not, and what happens if the cancellation request is sent twice.",
  },
  "linearizability": {
    breaks: "Without linearizability two nodes can both read free and both take the last seat or the lock, and a user can be told a fact by a friend that their own refresh then denies.",
    tradeoffs: "Every linearizable read or write goes through a leader or quorum round trip and must refuse or wait during a partition, so the guarantee is bought per object, not for the whole system.",
    explainSimply: "Imagine a scoreboard that every fan in the stadium sees at the same instant: when it changes, nobody can still see the old score. Weaker promises are like news spreading through a crowd, where everyone eventually hears the result but some people hear it later than their friends. Linearizability is the single-scoreboard promise, and it needs everyone to check with the scoreboard rather than the crowd.",
    hint: "Think about which guarantee mentions real time, which mentions transactions, and the name for the one that does both.",
  },
};
