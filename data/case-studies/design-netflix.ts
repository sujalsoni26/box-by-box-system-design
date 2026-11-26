import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-netflix",
  title: "Design Netflix",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design Netflix: when a member presses play, the picture should appear within about two seconds on thousands of device types, at the best bitrate the connection allows, with a personalised home page and resume across devices. Assume 300M accounts watching two hours a day on average and a catalogue of about 20,000 hours.",
  focus: "About 375 Tbps of prime-time video from a small, predictable catalogue of about 1 PB, so the bytes can be placed before anyone asks for them; the control plane is a large but ordinary web workload of about 100k external requests a second.",
  concepts: ["microservices", "circuit-breaker", "bulkheads-degradation", "multi-region", "cdn-internals", "stream-processing", "design-youtube"],
  steps: [
    {
      prompt: "What must be true when a member presses play, and which parts of the product are allowed to degrade?",
      hint: "Think about a country's prime-time peak crossing transit links, a cloud region failing, and what licensors require. Is a less personal home page as bad as a play button that does not work?",
      insight: "First frame in about two seconds with almost no rebuffering, video served from inside the viewer's ISP, play surviving the loss of a cloud region, and correct authorisation and content protection per country and plan. Freshness of minutes is fine for new titles and bookmarks; a less personal page is acceptable, a dead play button is not.",
    },
    {
      prompt: "Estimate concurrent streams, peak egress, the appliances needed and the nightly fill. What makes this catalogue different from YouTube's?",
      hint: "Two hours per account per day at 5 Mbps, with peaks of 3×. Use about 200 Gbps and 120 TB per appliance and 1% of the catalogue changing per day. How many times a day is each catalogue byte delivered?",
      insight: "About 75M concurrent streams and 375 Tbps at peak, roughly 4,000 appliances provisioned, against a catalogue of only about 1 PB that is delivered some 1,300 times a day. The catalogue is small and predictable, so tonight's bytes are known this morning and can be copied out before anyone asks, while the control plane answers about 100k external requests a second.",
    },
    {
      prompt: "Split the system into the part that decides and the part that delivers. What does the play call return, and how do you store per-profile state?",
      hint: "Which calls happen before the first byte, and between which boxes must a device fail over in under a second? Which data needs transactions, and which is written from every region?",
      insight: "A control plane in three active-active cloud regions authorises, personalises, steers and licenses, while a data plane of owned appliances inside ISPs serves the bytes. POST /playback/sessions returns the manifest and a ranked list of appliances, so the device fails over by itself. Accounts and billing are relational with a single writer, while bookmarks, history and experiment allocations are wide-column rows partitioned by profile_id and replicated to every region.",
    },
    {
      prompt: "How does the right 12% of the catalogue end up on each ISP appliance before prime time, and how is a client sent to the right box?",
      hint: "This is not a pull-through cache. What would you predict, when would you copy, and from where, so that 4,000 boxes do not all pull from the origin?",
      insight: "Forecast tomorrow's plays per region from playback events, the release calendar and rights, plan each appliance's 120 TB from the top, and fill it in the ISP's off-peak window (about 10 TB at 2.2 Gbps) from same-site peers, then from the exchange-point tier that holds the whole catalogue; only that tier pulls from the origin. Steer each play by health and BGP proximity, because the appliance is a replica that was told, not a cache that learns.",
    },
    {
      prompt: "Every title is encoded with the same bitrate ladder. Why is that expensive, and what would you do instead?",
      hint: "Compare a flat cartoon with a rain-soaked action scene at the same bitrate. How much of the 375 Tbps peak would a 20% bitrate saving remove?",
      insight: "Build the ladder per title: encode at many resolution and bitrate points, measure perceptual quality, and keep only the upper convex hull, so every rung is the cheapest way to reach its quality for that title. A 20% saving removes about 75 Tbps, roughly 375 appliances, at the cost of thousands of CPU-hours a day run as chunked jobs.",
    },
    {
      prompt: "The home page calls about 30 services, and personalisation starts timing out on 2% of pages. What should happen, and what does surviving a whole region failure require?",
      hint: "What would retries do to a struggling dependency? Which calls have a fallback, and which do not? How much capacity must each of three regions hold?",
      insight: "Give every dependency a timeout, a circuit breaker and its own bulkhead, with real fallbacks (cached rows, then unpersonalised rows) for the home page and none for the four play-path calls, which therefore get the most capacity and the fewest dependencies; retrying would double load at the worst moment. Provision each region at half of global peak so two can absorb a third, and rehearse with chaos testing and scheduled region evacuations.",
    },
  ],
  tradeoffs: [
    "Owned pre-filled CDN vs commercial pull-through CDN: pre-fill when tonight's bytes are known this morning; pull when they are not, as with YouTube's long tail of uploads.",
    "Last-writer-wins bookmarks vs synchronous cross-region replication: last-writer-wins, because two devices pausing a second apart harm nobody and the play path must never wait on another region.",
    "A strict concurrent-stream limit vs allowing during failover: lean towards allowing, because a fourth stream slipping through for a minute costs less than refusing a legitimate viewer.",
    "Retry vs fall back: retry what is idempotent and cheap, fall back on what is optional, and fail only the small thing that has no fallback.",
  ],
  followUps: [
    "Why does the licence service have no degraded mode, and how do you protect it?",
    "How would live events change the data plane?",
    "A title is missing from the viewer's local appliance at 9 p.m. What happens?",
    "Which metric tells you that last night's placement forecast was wrong?",
  ],
};
