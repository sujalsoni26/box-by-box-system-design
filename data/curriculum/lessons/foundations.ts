import type { LessonMeta } from "@/types/curriculum";

/** Module 1: Foundations. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/foundations.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "big-idea", title: "The big idea", moduleId: "foundations", level: "basic", minutes: 6,
    problem: "A system-design diagram full of boxes is easy to draw and hard to defend.",
    summary: "Grow one system step by step and add a building block only when a real problem forces it in. Then every box on your diagram has a reason.",
    catTip: "Hi, I'm Cache! I nap on servers, so I know when they get crowded. Every time something breaks in this course, a new box appears. I like boxes.",
    recall: { q: "What question should you ask about every box in a design?", a: "\"What problem does this box solve?\", not \"what is this box?\"" },
    archNodes: [],
  },
  {
    slug: "client-server", title: "Client–server architecture", moduleId: "foundations", level: "basic", minutes: 5,
    problem: "A phone can't hold everyone's photos or run the logic for millions of people, so the work has to live somewhere shared.",
    summary: "A client sends a request; a server does the work and returns a response. The client always starts the conversation.",
    catTip: "You are the client: you meow, I mean ask. The kitchen is the server: it does the work and hands back the food. The kitchen never shouts your name first.",
    recall: { q: "In the request–response model, who starts the conversation?", a: "The client, always. The server only responds." },
    archNodes: ["users"],
  },
  {
    slug: "dns", title: "DNS", moduleId: "foundations", level: "basic", minutes: 8,
    problem: "Computers find each other by IP address (203.0.113.10), but people type names (instagram.com).",
    summary: "DNS (Domain Name System) is the internet's phone book: it maps names to IP addresses, with caching at every step.",
    catTip: "DNS is how I find the treat cupboard. I check my own memory first, then ask around, then remember the answer for a while. TTL = treat-time-to-live.",
    recall: { q: "Why do DNS changes spread slowly?", a: "Resolvers and browsers cache answers for the record's TTL; the old IP keeps being served until those TTLs expire." },
    archNodes: ["dns"],
  },
  {
    slug: "tcp-udp", title: "IP, TCP and UDP", moduleId: "foundations", level: "basic", minutes: 9,
    problem: "The network only promises best effort: packets can be lost, duplicated or arrive out of order.",
    summary: "IP addresses and routes packets. TCP adds reliability and order at the cost of round trips; UDP skips all that for low latency.",
    catTip: "TCP is me bringing you a mouse and waiting until you say thank you. UDP is me flinging mice across the room. Faster, but some land behind the sofa.",
    recall: { q: "Why does a video call prefer UDP over TCP?", a: "A late frame is useless. UDP has no handshake or resends, so it keeps latency low; a lost packet just stays lost." },
    archNodes: ["users"],
  },
  {
    slug: "http", title: "HTTP and HTTPS", moduleId: "foundations", level: "basic", minutes: 9,
    problem: "Client and server need a shared message format, and on a public network anyone in between could read or change the bytes.",
    summary: "HTTP fixes the format: method, path, headers, body; status code back. HTTPS adds TLS for encryption, integrity and authentication.",
    catTip: "HTTP status codes, cat edition: 200 = treat delivered. 404 = treat not found. 429 = you asked for treats too many times. 503 = I am asleep.",
    recall: { q: "What three things does TLS add to HTTP?", a: "Encryption (no eavesdropping), integrity (no tampering) and authentication (the certificate proves the server is real)." },
    archNodes: ["users"],
  },
  {
    slug: "latency", title: "Latency, throughput and the numbers to know", moduleId: "foundations", level: "intermediate", minutes: 16,
    problem: "You can't make a system fast until you know where time goes and which part sets the pace.",
    summary: "Latency is time per operation, throughput is work per second. The slowest part sets the pace, percentiles beat averages, and a few latency ratios drive most design choices.",
    catTip: "RAM is me grabbing the toy next to my paw. SSD is walking to the toy box. Crossing a continent is waiting for my human to come home. Cache accordingly.",
    recall: { q: "State Little's Law and what you use it for.", a: "Requests in flight = throughput × average latency. Use it to size thread pools and DB connection pools." },
    archNodes: ["users"],
  },
];
