import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-instagram",
  title: "Design Instagram",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design the core of Instagram: post a photo with a caption, follow people, and open a home feed of the latest posts from accounts you follow, with likes and comments. Assume 500M daily active users who post twice a day on average, open the feed 50 times a day, and have about 200 followers each.",
  focus: "Two dominant numbers: about 1.2 Tbps of photo egress, a CDN problem, and about 2.5M post reads a second behind 250k feed views, a caching problem. The 200× fan-out multiplier is the design decision.",
  concepts: ["final-architecture", "normalization", "sharding", "caching", "pubsub", "cdn"],
  steps: [
    {
      prompt: "What is in scope for this round, and which non-functional requirements let you move work between the write path and the read path?",
      hint: "Decide how fresh a follower's feed and a like count must be, compared with how safe a post must be once the app says 'posted'. Which side is far larger: reads or writes?",
      insight: "Post, follow, a newest-first home feed, likes, comments and a profile grid; notifications, stories, video, messages, search, ads and ranking are out. The feed loads in under 500 ms at p99, a post is never lost once posted, the feed and counters prefer availability over consistency, and reads far outnumber writes, so the write path may do extra work to make reads cheap.",
    },
    {
      prompt: "Estimate post writes, feed reads, post hydrations, media egress and the cost of pushing every post to every follower. Which numbers dominate?",
      hint: "Each feed view shows 10 posts, each with a 60 KB rendition. For the push cost, multiply posts per second by 200 followers.",
      insight: "About 10k posts/s, 250k feed views/s and 2.5M post reads/s, with media egress near 150 GB/s, about 1.2 Tbps: one number is a CDN problem and the other a caching problem. Pushing to followers would be 2M list inserts a second, so the fan-out multiplier is the decision that shapes the feed.",
    },
    {
      prompt: "How do you shard users and posts, how are post IDs generated, and how do you answer both 'whom do I follow' and 'who follows me' without crossing shards?",
      hint: "An ID that sorts by time and also names its shard saves two lookups. For the follow graph, consider storing the same fact more than once.",
      insight: "Shard by user ID into thousands of logical shards mapped onto far fewer servers. A post ID packs 41 bits of milliseconds, 13 bits of logical shard and 10 bits of sequence, so it sorts by time (cursors need no timestamp) and routes without a lookup. Follows and followers are the same fact denormalized onto both users' shards, and each user's feed is a capped Redis list of post IDs only.",
    },
    {
      prompt: "Should the feed be built when someone posts or when someone reads? What breaks each approach?",
      hint: "Compare 10k posts × 200 followers with 250k reads × 200 followees. Then think about an account with 50M followers, and about users who have not opened the app for a month.",
      insight: "Fan-out on write wins for the average account (2M inserts a second against 50M post-list reads a second for pull), but one 50M-follower post would block the whole tier. Choose a hybrid: push for accounts under a threshold such as 100k followers, merge the few large accounts a user follows at read time from the post cache, and skip inactive users; the threshold is the largest fan-out budget you accept for one post.",
    },
    {
      prompt: "How do photos get from a phone to millions of viewers without 16 Gbps of uploads and 1.2 Tbps of reads passing through your servers?",
      hint: "Think about who uploads the bytes, when the smaller renditions are produced, how the event announcing a post stays consistent with the post row, and what makes a URL safe to cache for a year.",
      insight: "The phone uploads to object storage through a pre-signed URL, and POST /posts writes the row and an outbox row in one transaction, so PostCreated exists if and only if the post does. Workers produce three renditions asynchronously under immutable keys, the CDN serves them with year-long TTLs behind an origin shield, and originals move to a colder storage class after 30 days.",
    },
    {
      prompt: "A celebrity post collects 2,800 likes a second and is hydrated by a large share of all feed reads. What breaks, and how do you fix each problem?",
      hint: "Look at the row lock on like_count, at the single cache key everyone reads, and at what happens the moment that key expires.",
      insight: "Write each like as a row, whose primary key makes a double tap a no-op, and keep the count in Redis with INCR, flushed to the post row every few seconds and split into sub-keys if one node is not enough. Replicate the hot post key or keep a tiny in-process cache, and prevent stampedes with single-flight rebuilds and TTL jitter; all of this works only because the count is allowed to lag.",
    },
  ],
  tradeoffs: [
    "Fan-out on write vs on read: push for ordinary accounts, because reads outnumber posts 25 to 1; pull for celebrities, because one post would otherwise cost tens of millions of inserts.",
    "A feed cache of IDs vs of whole posts: cache IDs, because 16 bytes per entry fits every active user's feed in a few terabytes of RAM, and a deleted or liked post is fixed once in the post cache.",
    "A graph database vs adjacency tables for follows: adjacency rows plus a cache cover follow, unfollow and list, and nothing here needs a path query.",
    "Exact like counts vs lagging counters: lagging counters, because exact counts bring back the row lock on every hot post.",
  ],
  followUps: [
    "How does the author see their own post at once while followers receive it seconds later?",
    "A Redis node holding feed lists is lost. What do those users see, and how is their feed rebuilt?",
    "How would you add ranking to the feed without rebuilding it?",
    "What must every read path and every media URL check for private accounts?",
  ],
};
