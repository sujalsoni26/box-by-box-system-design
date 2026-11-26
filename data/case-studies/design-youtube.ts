import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-youtube",
  title: "Design YouTube",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design YouTube's video platform. Creators upload videos of several gigabytes from phones, and minutes later anyone can press play on a 2G connection or a fibre line without stalling, while view counts stay roughly right. Assume 500 hours of video uploaded every minute and 1B hours watched a day.",
  focus: "About 90 Tbps of egress, roughly 700 times the ingress: only a CDN can serve it, so the origin's job is to make segments cacheable. About 2.8 EB of storage a year and some 300k transcoding cores set the other two halves.",
  concepts: ["cdn", "object-storage", "message-queues", "cdn-internals", "partitions-consumer-groups", "stream-processing", "design-file-storage"],
  steps: [
    {
      prompt: "What are the functional requirements, and what must be true for viewers, for creators and for the bill?",
      hint: "Think about what viewers punish most, what a creator expects once the upload bar finishes, how exact a view count needs to be, and which cost grows with every play.",
      insight: "Upload large videos, process them into several resolutions, play them with adaptive quality on any device, seek, subscribe and count views and likes; live streaming, search, recommendations and ads are out. Playback starts within 2 s and does not stall, an upload is never lost once it says uploaded and is watchable at low quality within minutes, counts may lag, and egress is the budget.",
    },
    {
      prompt: "Estimate ingress, storage per year, transcoding compute and egress. What is the ratio of egress to ingress, and what does it tell you about where the design effort goes?",
      hint: "500 hours a minute is about 2.6 × 10⁹ seconds of video a day at 5 Mbps. The ladder adds about 2.2× the source and erasure coding 1.5×. Viewers watch 1B hours at 2.5 Mbps. Assume about 10 core-seconds to transcode one second of video.",
      insight: "Ingress is about 130 Gbps, storage about 2.8 EB a year, transcoding about 300k busy cores and egress about 90 Tbps, roughly 700 times the ingress. Ninety terabits a second can only come from a CDN, so the origin must produce cacheable segments; transcoding must be asynchronous and storage must be tiered.",
    },
    {
      prompt: "How does a 4 GB upload from a phone reach storage, and what metadata do you keep about a video, its renditions and its views?",
      hint: "Mobile connections drop mid-upload. Should the bytes pass through your API servers? How should view counts be stored so a viral video is not 100k row updates a second?",
      insight: "POST /v1/videos returns a resumable pre-signed URL; the client PUTs chunks with Content-Range and resumes from the last stored byte, so bytes never cross an application server. Videos and renditions are small SQL rows sharded by video_id, segments and manifests live in object storage under each rendition's prefix, and video_stats is written only by a stream job from an append-only log of view events.",
    },
    {
      prompt: "A two-hour 1080p upload must be watchable within minutes and end up in six rungs and two codecs. How do you structure the processing?",
      hint: "One encoder working through the file takes hours. Where can you cut the file so the pieces encode independently? Which rung should appear first, and which codec only when it pays for itself?",
      insight: "Run a DAG of small, idempotent jobs: probe, split at keyframes into chunks of about 10 seconds, encode each (chunk, rung, codec) in parallel from a queue, then stitch into 6-second segments aligned across rungs. Publish 360p first and add rungs to the manifest as they finish, and encode the costlier VP9 ladder only for videos whose expected views repay the compute, because the DAG is a cost model with a scheduler.",
    },
    {
      prompt: "How does the player stay smooth when the viewer's bandwidth changes mid-video, and what must the server do to make that possible?",
      hint: "Who is best placed to measure the viewer's bandwidth? Think about what must be true of segments across rungs for a switch to be seamless, and about how long a segment should be.",
      insight: "The player picks a rung for each segment from measured throughput and its buffer, using an HLS or DASH manifest that lists every rung's bandwidth and resolution. Segments must be aligned across rungs, short (about 6 s on demand, 2 s or less for live) and immutable with fixed URLs, so the server's job is to be boring: static files that thousands of edges can cache for a year.",
    },
    {
      prompt: "Heartbeats arrive at 180k a second at peak, concentrated on a few videos. How do you produce a count that is roughly right now, exactly right for payouts later, and not inflated by scripts?",
      hint: "Keep row updates off the request path. Where do you deduplicate, and what do you do when one premiere's events all land on one partition? Should payouts read the live counter?",
      insight: "Append heartbeats to a log partitioned by video_id; a stream job deduplicates by session, counts a view after a watch-time threshold and writes one delta per video per minute. Salt hot videos' keys across several partitions and sum their deltas, let a slower job verify and revise counts downwards, and compute payouts in batch from the retained log, because the counter you show and the counter you pay on are different numbers.",
    },
  ],
  tradeoffs: [
    "Pre-transcoding the ladder vs transcoding on demand: pre-transcode the cheap rungs for every video so players can always switch and segments stay cacheable; add expensive codecs only when expected views times bandwidth saved exceed the encode cost.",
    "Short vs long segments: about 6 s on demand balances request overhead against adapting quickly; about 2 s for live; never 30 s, because adapting would take half a minute.",
    "Hot tier vs instant-access cold tier vs deep archive: originals go to the deep archive and cold renditions to an instant-access cold tier, because an hours-long restore is fine for a master and fatal for playback.",
    "A row update per view vs an event log plus a stream job: the log, because a viral video would otherwise serialise 100k writes a second on one row.",
  ],
  followUps: [
    "A transcoding worker dies halfway through a chunk. Why is nothing broken ever published?",
    "How do you protect private and unlisted videos when the CDN cannot check a session?",
    "What would have to change to support live streaming?",
    "At a 95% CDN hit ratio, how much egress still reaches the origin, and what is one point of hit ratio worth?",
  ],
};
