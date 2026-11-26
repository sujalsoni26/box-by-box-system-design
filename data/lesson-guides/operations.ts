import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 10: Reliability and Observability, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Reliability and Observability
  "failure-modes": {
    breaks: "Two replicas in one rack die together when the switch fails, one config service takes down both regions, and a host that answers health checks while timing out real requests keeps getting traffic.",
    tradeoffs: "Every failure domain you span adds latency, replication lag or cost, active-active copies need headroom to absorb a lost peer, and catching grey failure means measuring from the caller's side instead of trusting a health check.",
    explainSimply: "Things break in layers: a flaw turns into a wrong state, which turns into something a user notices. Keeping spare copies only helps if the copies cannot break for the same reason, like keeping a spare house key with a neighbour instead of on the same keyring. Some breakages are sneaky: the server says it is fine while quietly doing a terrible job.",
    hint: "Ask what the copies have in common: the rack, the zone, the dependency, the deploy.",
  },
  "bulkheads-degradation": {
    breaks: "A hung ads service fills the shared thread pool so checkout and search fail with it, a poison request takes down every customer on a shared shard, and under load everything degrades at once, including payments.",
    tradeoffs: "Separate pools waste idle capacity, cells make cross-customer queries and tenant moves hard, kill switches and fallbacks are code paths that rot unless exercised, and every flag carries a maintenance cost.",
    explainSimply: "A ship is divided into watertight compartments so one leak does not sink it. Software does the same: each outside service gets its own small pool of workers, each group of customers gets its own copy of the system, and features come with an off switch so the important ones keep working when the rest are turned off.",
    hint: "Think about what one misbehaving caller or dependency is allowed to use up, and what gets switched off first.",
  },
  "slos-error-budgets": {
    breaks: "Threshold alerts page at night on blips users never notice and stay silent during a slow bleed that eats the whole month's reliability, while product and operations argue about what 'reliable enough' means.",
    tradeoffs: "Good SLIs need measurement at the load balancer or client, a window long enough to be meaningful makes one bad day haunt you for weeks, and an honest budget policy occasionally freezes a launch the business wanted.",
    explainSimply: "An SLO is a promise like 'the app works 999 times out of 1,000 this month'. The one failure in a thousand is your budget, like a monthly data allowance: spend it slowly on experiments or lose it all in one bad afternoon. Alerts should ring when you are spending it far too fast, not on every tiny hiccup.",
    hint: "Think of the SLO as a monthly allowance and ask how fast it is being spent, not whether it has run out.",
  },
  "metrics-monitoring": {
    breaks: "Without the right instruments the team graphs averages that hide the tail, averages percentiles into nonsense, and pages on causes like CPU that nobody can act on at 3 a.m.",
    tradeoffs: "Histograms cost a dozen series per label combination, bounded labels mean you cannot query metrics by user, and symptom-only paging means some causes are found later on a dashboard rather than by a page.",
    explainSimply: "A metric is a number you record over and over: how many requests came in, how many are being handled right now, how long each one took. Think of a car: the odometer only goes up, the speedometer goes up and down, and a tally of journey times sorted into buckets tells you how often a trip was slow. Alerts should work like a smoke alarm, ringing on the smoke rather than on every warm pan.",
    hint: "Ask which quantity you can add across machines: a position in a distribution, or a count of observations in a bucket.",
  },
  "logging": {
    breaks: "Without structure, ids and a budget, an incident means grepping fifty services' prose for a user's name, the log bill outgrows the database, and a token someone logged for debugging sits in cold storage for a year.",
    tradeoffs: "Structured logging needs discipline about field names, sampling means some INFO lines are gone when you want them, and redaction at the source can hide the very value you needed to debug a case.",
    explainSimply: "A log is a diary of what the system did. Writing each entry as a form with labelled boxes rather than a sentence lets you search a million entries in a second. Stamp every entry with the id of the customer's request, keep recent entries close at hand and old ones in a cheap archive, and never write down passwords or card numbers.",
    hint: "Think of a receipt with labelled fields rather than a story, stamped with one order number that follows the request everywhere.",
  },
  "tracing": {
    breaks: "Without propagated context each service records its timings in isolation, so a slow request becomes a nine-way argument, N+1 query storms hide in plain sight, and the one failing request in a thousand leaves no connected record.",
    tradeoffs: "Recording every span of every request is unaffordable, so you sample and lose detail; tail sampling needs stateful collectors; and context must cross every hop, including message queues, or the trace breaks in two.",
    explainSimply: "A trace follows one request like a parcel with a tracking number scanned at every depot. Each service adds its own step with a start and end time, and the tracking number travels in a header so the steps can be stitched together. The result reads like a timeline that shows exactly where the waiting happened.",
    hint: "Think about what has to travel with the request so that two services can agree they worked on the same one.",
  },
  "disaster-recovery": {
    breaks: "Without a tiered plan a regional outage becomes an improvised rebuild, asynchronous replication quietly loses the last seconds of payments, and a backup that was never restored turns out to be unreadable on the worst day.",
    tradeoffs: "Each step down in RTO and RPO means more standing infrastructure in a second region, synchronous replication adds write latency, residency rules can forbid the obvious recovery region, and rehearsals cost real engineering time.",
    explainSimply: "Losing one server is like a flat tyre: the spare gets you going. A disaster is losing the whole car, so you decide in advance how much you can afford to lose and how long you can wait, and keep anything from a saved copy of your route to a second car already running. Then you practise the swap before you need it.",
    hint: "Two numbers decide everything: how much data you can lose, and how long you can be down.",
  },
  "capacity-planning": {
    breaks: "Without headroom a modest spike forms queues and latency explodes, a lost zone overloads the survivors before autoscaling reacts, and connection pools sized for the fast case exhaust the moment the database slows.",
    tradeoffs: "Headroom is paid-for idle capacity, load tests need production-like environments and data, and forecasts are wrong in both directions, so you buy insurance against the expensive mistake rather than the cheap one.",
    explainSimply: "A road at 95% full jams the moment one driver brakes, so you plan traffic with empty lanes to spare. Capacity planning is deciding how many lanes to have for the busiest hour, keeping extra in case one closes, and testing the road with fake traffic to find out where it clogs.",
    hint: "Think of latency as queue length, and ask what happens to a queue as the server gets busier.",
  },
  "incident-response": {
    breaks: "Without roles and a timeline, several people fix the same thing while nobody talks to customers, and without a blameless postmortem the organisation hides causes and repeats the outage.",
    tradeoffs: "Formal roles, status cadences, postmortem reviews and game days cost engineering time on every incident and every quarter, and averages such as MTTR are too noisy to prove the investment is paying off.",
    explainSimply: "An incident is run like an emergency room: triage decides how serious it is, one person leads and does not also operate, one person keeps the chart and one talks to the family. Afterwards the team reviews the chart without blaming anyone and fixes what let the mistake happen. Then they rehearse, so that the next real emergency is not the first time.",
    hint: "Think about the three jobs that must happen at once during an outage and who holds the ones nobody has taken.",
  },
};
