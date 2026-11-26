import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-uber",
  title: "Design Uber",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design the core of a ride-hailing service like Uber. Drivers stream their location, a rider sees nearby cars with a price and a pickup time, requests a ride and is matched with exactly one driver, and both track each other until the trip ends. Assume 20M trips a day, 1M drivers online at the evening peak reporting every 4 seconds, and surge pricing.",
  focus: "About 250k position writes a second against roughly 600 ride requests a second, 400 to 1, and the two halves want opposite things: a lossy in-memory stream and a small transactional core.",
  concepts: ["websockets", "sharding", "consistency", "mvcc-isolation", "sagas", "stream-processing"],
  steps: [
    {
      prompt: "What must the system guarantee about driver assignment, position freshness and time to match, and where is it acceptable to lose data?",
      hint: "Compare losing one location sample with assigning two drivers to one rider. What should happen to a whole city if one database shard is failing over?",
      insight: "Exactly one driver per trip, positions fresh within about 5 s, a match within 10 s, and a durable, auditable trip record because it is the bill. Location ingest and tracking favour availability, and losing a sample is fine because the next one supersedes it; routing internals, pooling and the payment system itself are out of scope.",
    },
    {
      prompt: "Estimate location updates, trip requests, nearby-driver queries and ETA computations. Which ratio dominates, and what does it say about how positions should be stored?",
      hint: "300k drivers online on average and 1M at peak, one update every 4 s, 20M trips a day. Each app open shows about 20 cars with ETAs, and in-trip ETAs refresh every 10 s.",
      insight: "About 250k position writes a second at peak against about 600 trip requests a second, roughly 400 to 1, while the whole live set is only about 100 MB. Positions are a firehose in which each sample makes the last worthless, so they belong in memory without durability, and trips are rare and valuable, so each gets a transaction; ETA, at about 120k calls a second, is the hidden hot read path.",
    },
    {
      prompt: "Sketch the driver and rider interactions and the tables. What goes into SQL, what never does, and how do you make the price the rider taps the price they pay?",
      hint: "Should a location frame be acknowledged? Think about freezing fare and surge before dispatch, about making a double tap and a driver's accept idempotent, and about which rows must change together.",
      insight: "Drivers send fire-and-forget location frames over a WebSocket; a quote freezes fare, surge and pickup ETA for two minutes; POST /v1/trips takes an idempotency key, and each offer carries an offer_id. Trips, drivers and offers live in SQL sharded by region_id, so a trip and its driver share a shard, while live positions exist only as an in-memory map from cell to drivers plus an append-only history log.",
    },
    {
      prompt: "How do you answer 'which drivers are within 2 km of this pickup?' in milliseconds when a million points move every 4 seconds?",
      hint: "Compare a fixed grid of cells, a quadtree and a database R-tree by what each one pays when a point moves. Then think about an airport rank with thousands of idle drivers in one place.",
      insight: "Use a fixed grid (geohash, S2 or H3) held in memory and sharded by region: a move is one delete and one insert, and a query reads the pickup cell's k-ring and filters by exact distance. H3 hexagons have a single neighbour distance and also drive surge, and a hot cell is additionally indexed at a finer resolution; a quadtree suits static points such as restaurants, because it pays on every one of 250k writes a second.",
    },
    {
      prompt: "A dispatcher retries after a timeout, a driver taps accept as the offer expires, and two trips race for the same idle driver. How do you guarantee exactly one assignment?",
      hint: "Do not hold a lock across a 15-second offer. What if every update named the state it expects to leave? Which shard key keeps both rows in one place?",
      insight: "Offer the trip to one driver at a time, then assign in one transaction with two conditional updates: driver available or offered to assigned, and trip requested to matched, committing only if each changes exactly one row and answering 409 otherwise. Sharding trips and drivers by region keeps this invariant on one shard; a cross-region case needs a saga with a compensating release or a globally consistent store.",
    },
    {
      prompt: "Why are surge pricing and ETA separate services, and what happens to a rider's price if surge changes while they are booking?",
      hint: "Compare the load and failure modes of a stream aggregation, a model service and the trip state machine. What should dispatch do if the ETA service is down?",
      insight: "Surge is a stream job that every 30 s compares demand with supply per hexagon, smooths across neighbours and writes a multiplier to a 60-second cache, and it is frozen into the quote, so a recompute changes the next rider's price, not this one's. ETA combines a routing engine with a learned correction at about 120k calls a second and degrades to a straight-line estimate with a wide range, because a stale price, a slow ETA and a wrong assignment must be able to fail separately.",
    },
  ],
  tradeoffs: [
    "Sequential vs broadcast offers: sequential offers avoid races and 'sorry, taken' at the cost of wait time; broadcast to a small set when drivers decline often.",
    "Fixed grid vs quadtree: a grid for points that move constantly, a quadtree for static points with uneven density.",
    "Positions in SQL vs in memory: in memory, because 250k writes a second to protect data that is obsolete in 4 s buys nothing.",
    "Road ETA vs straight-line ranking: rank by road ETA, because a driver across a river is not close; fall back to straight-line only when ETA is unavailable.",
  ],
  followUps: [
    "A geo index node dies. What do riders see, and how is the index rebuilt?",
    "How would you defend against drivers spoofing GPS into a surge zone?",
    "What changes at 10× when matching becomes an optimisation across many open requests at once?",
    "A trip crosses from one city's region into another. What breaks, and what are your options?",
  ],
};
