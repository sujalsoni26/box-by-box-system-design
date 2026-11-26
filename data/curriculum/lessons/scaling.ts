import type { LessonMeta } from "@/types/curriculum";

/** Module 2: Scaling and Traffic. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/scaling.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "proxy", title: "Proxy and reverse proxy", moduleId: "scaling", level: "basic", minutes: 6,
    problem: "Clients shouldn't talk to your servers directly: you need one front door for routing, security and caching.",
    summary: "A forward proxy speaks for clients; a reverse proxy speaks for servers, so clients never see the real backends.",
    catTip: "A reverse proxy is like me guarding the kitchen door. You never meet the chefs; you meet me, and I decide who gets which treat.",
    recall: { q: "Forward proxy vs reverse proxy: who does each one sit in front of?", a: "A forward proxy sits in front of clients and speaks for them; a reverse proxy sits in front of servers and hides them." },
    archNodes: ["gateway"],
  },
  {
    slug: "load-balancing", title: "Load balancing", moduleId: "scaling", level: "basic", minutes: 9,
    problem: "One server can't take all the traffic, and if it dies the whole app goes down.",
    summary: "A load balancer spreads requests across a pool of servers and uses health checks to route around dead ones.",
    catTip: "Three humans, one cat. I spread my demands evenly so nobody burns out. If one human stops answering my meows, I skip them until they wake up. Health checks!",
    recall: { q: "Which load-balancing algorithm suits requests with very different durations?", a: "Least connections: send each request to the server with the fewest active connections." },
    archNodes: ["gateway"],
  },
  {
    slug: "scaling", title: "Vertical vs horizontal scaling", moduleId: "scaling", level: "basic", minutes: 9,
    problem: "Load keeps growing until latency climbs into seconds, connections time out and the server returns 503.",
    summary: "Scale up with a bigger machine or scale out with more machines behind a load balancer. Scaling out needs stateless servers.",
    catTip: "Scaling up: one giant cat bed. Scaling out: many cat beds around the house. If one bed gets taken, I simply nap in another. Fault tolerance.",
    recall: { q: "What must be true of servers before you can scale horizontally?", a: "They must be stateless: sessions live in a shared store (Redis, the DB) or a token, so any server can serve any request." },
    archNodes: ["gateway"],
  },
  {
    slug: "cdn", title: "CDN", moduleId: "scaling", level: "basic", minutes: 8,
    problem: "Every user fetching the same images and scripts from one faraway origin is slow for them and expensive for you.",
    summary: "A CDN (Content Delivery Network) caches static content on edge servers near users, so most requests never reach your origin.",
    catTip: "A CDN is hiding snack stashes in every room so I never walk to the kitchen. The kitchen only restocks a stash when it runs out.",
    recall: { q: "How do you avoid users getting a stale app.js from a CDN after a deploy?", a: "Use versioned file names (app.3f9a2.js); otherwise rely on TTLs or explicit invalidation." },
    archNodes: ["cdn"],
  },
];
