import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 2: Scaling and Traffic, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Scaling and traffic: 10k users
  proxy: {
    breaks: "Without a front door, every backend server is exposed to the internet, each one handles TLS and filters bad traffic on its own, and moving a server means changing what clients connect to.",
    tradeoffs: "Every request passes through one more hop, and the proxy is one more component to run and configure, so it must not become a single point of failure.",
    explainSimply: "A reverse proxy is like a company switchboard. Callers dial one public number, and the operator connects them to the right desk without giving out direct lines. A forward proxy is the opposite: an assistant who places calls for you, so the other side only sees the assistant.",
    hint: "Ask whose identity each proxy hides: the people sending requests, or the machines answering them.",
  },
  "load-balancing": {
    breaks: "With 10k users pointed at one server, pages crawl at peak, and when that server crashes or restarts for a deploy, every user gets errors until it comes back.",
    tradeoffs: "The load balancer is one more component in the request path, and unless you run a redundant pair or a managed service it becomes the new single point of failure.",
    explainSimply: "A load balancer is like the person at the entrance of a bank who sends each customer to a free counter. If a counter closes, they stop sending people there until it reopens. Checking which counters are open is called a health check.",
    hint: "If one request takes 5 ms and another takes 5 s, taking turns ignores how busy each server really is; what could you count instead?",
  },
  scaling: {
    breaks: "Stay on one machine and you hit a hard ceiling, with any failure taking the whole app down; add machines while sessions live in server memory and a refresh that lands on another server logs the user out.",
    tradeoffs: "Scaling up needs no code changes but cost rises steeply and one machine stays a single point of failure, while scaling out needs a load balancer, stateless servers and coordination.",
    explainSimply: "Scaling up is buying one bigger, faster delivery van. Scaling out is buying more ordinary vans plus a dispatcher who hands out the parcels. More vans keep going when one breaks down, but only if any van can deliver any parcel.",
    hint: "Think about what a load balancer assumes when it sends your next request to any machine in the pool.",
  },
  cdn: {
    breaks: "Users far from your one data center wait while every photo and script crosses a continent, and your origin serves the same bytes millions of times until a traffic spike overwhelms it.",
    tradeoffs: "Edge copies can go stale after a deploy, a CDN does little for personalised content, and it costs money.",
    explainSimply: "A CDN is like a chain of local warehouses for files that are the same for everyone, such as photos and scripts. Users collect from the nearest warehouse, and only when it lacks an item does it fetch one from the main factory. Most trips stay short and the factory stays calm.",
    hint: "The edge caches by URL; think about how to make sure a new version of a file never shares a URL with the old one.",
  },
};
