import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 12: Cloud and Infrastructure, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Cloud and Infrastructure
  "containers": {
    breaks: "Without a packaged, immutable artefact, every server is configured by hand or by drifting scripts, deployments cannot be reproduced and a rollback means guessing what the previous state was.",
    tradeoffs: "Containers share the host kernel, so isolation is weaker than a virtual machine's, and immutability pushes every environment difference into configuration you must inject and manage separately.",
    explainSimply: "A container is like a lunchbox packed at home: everything the meal needs is inside, so it is the same lunch whether you eat it at school or in the park. The box is sealed once packed; for a different lunch you pack a new box rather than fiddling with the old one. Every box still shares the same table.",
    hint: "Think about what is inside the box (filesystem, dependencies) and what every box borrows from the building it sits in.",
  },
  "kubernetes": {
    breaks: "Without an orchestrator nothing replaces a crashed container, callers must track changing Pod IPs by hand, and a rollout that produces a broken version takes the whole service down before anyone notices.",
    tradeoffs: "You take on a control plane, a large YAML surface and probe, request and limit settings that are wrong by default for your workload, which is why most teams run a managed Kubernetes rather than their own.",
    explainSimply: "Kubernetes is a thermostat for software: you say how many copies you want running and how they should be reached, and it keeps adjusting until reality matches. If a copy crashes it starts another, and when you change the version it swaps copies a few at a time, checking each new one works before retiring an old one.",
    hint: "Think about which probe removes a Pod from traffic and which one restarts it.",
  },
  "service-discovery": {
    breaks: "Callers that hold fixed addresses keep sending requests to instances that were replaced or died, and every deployment or scale-down turns into a wave of connection errors.",
    tradeoffs: "The registry becomes a dependency of every request and its view is always slightly stale, so you tune heartbeat intervals between detecting failures quickly and wrongly evicting slow but healthy instances.",
    explainSimply: "Imagine phoning a hospital: you can keep the duty rota in your own phone and call a doctor directly, or dial the switchboard and let it put you through to whoever is on duty. The rota in your phone goes stale; the switchboard must never be engaged. Service discovery is choosing one of those two and keeping the rota fresh.",
    hint: "Think about which part of the answer stays fixed and which part changes with every rollout.",
  },
  "autoscaling": {
    breaks: "A fleet sized by hand is either paying for idle machines or falling over during a spike, and a naive autoscaler oscillates, arrives too late, or scales the web tier past what the database can serve.",
    tradeoffs: "Every defence against lag costs money or latency: headroom and slow scale-in keep idle capacity, stabilisation delays savings, scale to zero makes the first request wait, and a maximum set too low drops traffic.",
    explainSimply: "Autoscaling is a thermostat for servers: when the room gets hot it turns on more cooling, and when it cools down it turns some off. The catch is that the cooling takes minutes to start, so you switch it on early, keep some running just in case, and do not switch it off the moment the temperature dips.",
    hint: "Think about what happens in the minutes between the metric crossing the line and the new machine serving its first request.",
  },
  "multi-region": {
    breaks: "A single region makes every distant user pay a cross-continent round trip and turns a regional outage into a total outage, while a second region added without a data strategy produces conflicting writes or silent data loss at failover.",
    tradeoffs: "Each data strategy pays somewhere: single-writer makes far users wait, geo-partitioning punishes travellers, multi-leader loses conflicting updates and consensus adds a cross-region round trip to every write, on top of doubled infrastructure and transfer cost.",
    explainSimply: "Running in two regions is like a shop chain with branches in two cities: customers go to the nearest branch, and if one burns down the other keeps trading. The hard question is the ledger: one master book the far branch phones into, separate books per customer, two books reconciled later, or no sale recorded until both branches agree.",
    hint: "Think about who is allowed to write each kind of data, and what happens to the last second of writes when a region disappears.",
  },
  "cdn-internals": {
    breaks: "Without deliberate cache keys, tiers and freshness rules, every edge fetches popular objects from the origin independently, a cookie or query string silently splits the cache into useless variants, and an origin outage becomes an immediate user-facing error.",
    tradeoffs: "Every mechanism trades hit ratio against correctness or latency: a richer cache key means more misses, a longer TTL means staler pages, a shield adds a hop, and edge functions add their run time to every request they touch.",
    explainSimply: "A CDN is a chain of branch libraries with a regional depot behind them. Each branch keeps popular books for a set loan period, borrows from the depot rather than the publisher when it runs out, and files books by catalogue number, so if two branches use different numbers for the same book they both order copies. A recall notice pulls a book early.",
    hint: "Think about what makes two requests count as the same object, and who talks to the origin when the copy is missing.",
  },
  "cloud-networking": {
    breaks: "Without private subnets and stateful security groups every server is reachable from the internet, and a single-zone NAT gateway or a stateless rule that forgets ephemeral ports cuts off whole tiers at once.",
    tradeoffs: "Private subnets need NAT gateways that are zonal and charge per gigabyte, PrivateLink endpoints cost per hour per zone, and every extra boundary is another route table and rule set to get wrong.",
    explainSimply: "A VPC is an office building you design: reception lets visitors into the lobby floors only, the mail room sends parcels out from the private floors but accepts none in, and each door lock remembers who it let through. You build one mail room per wing so a flood does not stop the whole building's post.",
    hint: "Think about which route makes a subnet public, and what the private ones use instead.",
  },
  "iac": {
    breaks: "Hand-built environments cannot be reproduced or audited, a change made in the console during an incident silently diverges from the configuration, and recovering in a new region takes days instead of minutes.",
    tradeoffs: "You now operate the tooling: a sensitive state file to protect and lock, plans to review, drift to reconcile, and a pipeline or GitOps agent whose permissions are among the most powerful credentials in the company.",
    explainSimply: "Infrastructure as Code is building from blueprints instead of a foreman's memory: anyone can rebuild the same thing anywhere, and every change to the blueprint is reviewed before the builders act. If someone knocks through a wall without updating the blueprint, an inspection shows the difference, and in GitOps the builders put the wall back.",
    hint: "Think about what the tool must remember between runs, and what goes wrong when two runs happen at once.",
  },
};
