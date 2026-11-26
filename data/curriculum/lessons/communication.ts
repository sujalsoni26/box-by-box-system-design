import type { LessonMeta } from "@/types/curriculum";

/** Module 3: Communication. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/communication.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "rest", title: "REST APIs", moduleId: "communication", level: "basic", minutes: 8,
    problem: "Separate pieces of software need a clear contract: what you can ask, in what format, and what comes back.",
    summary: "REST models everything as a resource with a URL and uses HTTP methods as the verbs. It is simple, universal and cacheable.",
    catTip: "REST, cat edition: GET /bowl checks the food. POST /bowl demands more. DELETE /cucumber removes the scary vegetable. URLs are nouns, methods are verbs.",
    recall: { q: "What are over-fetching and under-fetching in REST?", a: "Over-fetching: an endpoint returns more than the screen needs. Under-fetching: one screen needs several calls." },
    archNodes: ["feed"],
  },
  {
    slug: "grpc", title: "gRPC", moduleId: "communication", level: "intermediate", minutes: 8,
    problem: "Inside your system, services call each other thousands of times per second, and verbose JSON wastes time and bytes.",
    summary: "gRPC lets one service call another's function as if it were local, using compact binary Protocol Buffers over HTTP/2.",
    catTip: "gRPC is my secret tail-flick language with other cats: tiny, fast, strictly typed. Humans can't read it, which is exactly why it's efficient.",
    recall: { q: "Why is gRPC usually kept for internal calls rather than public browser APIs?", a: "Binary protobuf isn't human-readable, browsers need gRPC-Web or a proxy, and services couple to a shared schema." },
    archNodes: ["feed"],
  },
  {
    slug: "websockets", title: "WebSockets (real-time)", moduleId: "communication", level: "intermediate", minutes: 9,
    problem: "In plain HTTP only the client can start a conversation, so how does a chat app learn about a new message the moment it arrives?",
    summary: "Polling asks repeatedly, long polling waits, SSE streams one way, and a WebSocket keeps a two-way connection open so the server can push instantly.",
    catTip: "Polling is me asking \"is it dinner?\" every five seconds. A WebSocket is you promising to shout the moment the bowl is full. Much less meowing.",
    recall: { q: "What makes WebSockets harder to scale than REST?", a: "Each server holds many long-lived stateful connections, and delivering a message means finding the server holding the recipient's connection (often via Redis pub/sub)." },
    archNodes: ["chat"],
  },
  {
    slug: "microservices", title: "Monolith vs microservices", moduleId: "communication", level: "intermediate", minutes: 9,
    problem: "As the app and the team grow, one codebase deployed as one unit means teams step on each other, and one bug can take everything down.",
    summary: "Microservices split the app into small independent services, each owning one capability and usually its own database. You gain independent deploys and scaling, and you pay with a distributed system.",
    catTip: "One big cat bed is cosy until twelve cats want it. Twelve little beds is fairer, but now somebody must track who sleeps where. That somebody is the API gateway.",
    recall: { q: "Name the two pieces of plumbing you need once you split into microservices.", a: "An API gateway (one entry point: routing, auth, rate limiting, TLS, logging) and service discovery (finding services’ changing addresses)." },
    archNodes: ["feed"],
  },
  {
    slug: "sync-async", title: "Synchronous vs asynchronous communication", moduleId: "communication", level: "basic", minutes: 6,
    problem: "If every service call waits for the reply, one slow or dead service slows or fails everything that calls it, and the delays add up along the chain.",
    summary: "Call synchronously when you need the answer now; emit a message and move on for side effects. Posting a photo saves the post synchronously and does the rest asynchronously.",
    catTip: "Synchronous is me staring at you until you fill my bowl. Asynchronous is leaving a note on the fridge and going back to my nap. Both get me fed.",
    recall: { q: "Posting a photo: which steps are synchronous and which are asynchronous?", a: "Save the post synchronously; resize images, notify followers and update analytics asynchronously." },
    archNodes: ["post"],
  },
];
