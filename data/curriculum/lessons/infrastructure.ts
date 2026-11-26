import type { LessonMeta } from "@/types/curriculum";

/** Module 12: Cloud and Infrastructure. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/infrastructure.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "containers", title: "Containers and images", moduleId: "infrastructure", level: "basic", minutes: 12,
    problem: "Software installed by hand on dozens of servers drifts, so the same request behaves differently depending on which machine the load balancer picks.",
    summary: "A container is a process the Linux kernel isolates with namespaces and cgroups while sharing its kernel. An image is the immutable, layered filesystem it starts from, so one tested artefact runs identically on every machine.",
    catTip: "I nap in a cardboard box. Same box on the sofa, the shelf or the server rack, and I fit exactly the same way every time. That is an image: pack once, run anywhere, and share the floor, the kernel, with the other boxes.",
    recall: { q: "Your service runs fine on one machine and misbehaves on three others. How do containers fix this, and what do they still share with the host?", a: "The image packages the whole filesystem and its dependencies as immutable layers, so every machine runs identical bytes; namespaces give each container its own process tree, network and mounts and cgroups cap its CPU and memory. Every container still shares the host kernel, so isolation is weaker than a VM's." },
    archNodes: [],
  },
  {
    slug: "kubernetes", title: "Kubernetes fundamentals", moduleId: "infrastructure", level: "intermediate", minutes: 16,
    problem: "Hundreds of containers across dozens of machines need placing, restarting, addressing and upgrading, and doing it by hand or by script fails the first time a node dies mid-rollout.",
    summary: "Kubernetes keeps a fleet of containers matching a declared desired state: Deployments roll Pods out through ReplicaSets, Services give them a stable address, Ingress or Gateway routes HTTP in, probes decide who is healthy, and requests and limits tell the scheduler where things fit.",
    catTip: "I do not chase every mouse myself. I declare three mice, caught, and let the kittens reconcile reality with the plan. If one kitten naps, another takes the shift. That is a controller loop, with whiskers.",
    recall: { q: "During a rollout a new Pod starts but cannot reach the database yet. Which probe keeps it from taking traffic, and why must that check not be the liveness probe?", a: "The readiness probe: while it fails the Pod is removed from the Service's EndpointSlices, so no traffic reaches it and the rolling update pauses. A liveness failure restarts the container, so a dependency check there would restart every Pod whenever the database blips." },
    archNodes: ["gateway"],
  },
  {
    slug: "service-discovery", title: "Service discovery and internal DNS", moduleId: "infrastructure", level: "intermediate", minutes: 12,
    problem: "Service instances are created and destroyed all day, so any address a caller writes down is wrong within hours and requests go to machines that no longer exist.",
    summary: "A registry tracks which instances of a service are alive; either the client or a router consults it per request. Kubernetes Services, Consul, etcd and Eureka differ in who registers, how health is judged and how stale the answer can be.",
    catTip: "The humans keep moving my food bowl. I do not memorise the spot; I ask the dog, who always knows where it is now. Sometimes the dog is ten seconds behind. I sniff, I retry. Discovery is a cache of who is where.",
    recall: { q: "A caller in Kubernetes resolves pricing.payments.svc.cluster.local. What does the answer contain, and how does traffic then reach a healthy Pod?", a: "The ClusterIP, a stable virtual IP that never changes while Pods churn. kube-proxy on each node rewrites traffic for that IP to one of the Pod IPs listed in the Service's EndpointSlices, which contain only Pods currently passing their readiness probe." },
    archNodes: [],
  },
  {
    slug: "autoscaling", title: "Autoscaling", moduleId: "infrastructure", level: "intermediate", minutes: 12,
    problem: "Traffic doubles in minutes but a new machine takes minutes to boot and warm up, so capacity added on a signal arrives late, flaps, or overwhelms the database behind it.",
    summary: "Autoscaling changes capacity from a signal such as CPU, requests per instance or queue depth. Because new capacity lags the signal, policies add stabilisation windows, cooldowns, headroom and hard maximums; horizontal, vertical, cluster and scale-to-zero autoscalers each trade cost against reaction time.",
    catTip: "When the bowl empties faster than the human refills it, I do not wait for the hunger signal: I start meowing at 5:55. Predictive scaling. And I stop meowing slowly, in case a second helping is coming. Stabilisation window.",
    recall: { q: "Your HPA scales down right after scaling up, over and over. Which two defaults are meant to stop this, and what are their values?", a: "The tolerance (changes within 10% of the target are ignored) and the scale-down stabilisation window (300 seconds by default, during which the HPA uses the highest desired count it computed). Scale-up has no window on purpose: add capacity fast, remove it slowly." },
    archNodes: [],
  },
  {
    slug: "multi-region", title: "Multi-region deployment", moduleId: "infrastructure", level: "advanced", minutes: 16,
    problem: "One region serves the whole world, so distant users pay a cross-continent round trip on every request and a regional outage takes the entire product down for hours.",
    summary: "Running in several regions cuts latency and survives a regional failure, but every design reduces to a data decision: single writer, geo-partitioned, multi-leader with conflicts, or cross-region consensus. Users are steered by GeoDNS, anycast or a global load balancer, and failover costs the replication lag.",
    catTip: "I keep two napping spots, one at each end of the house. The sunny one is primary. If the humans vacuum there I move, but the mouse I half-buried in the sunny cushion does not come with me. That is the replication lag.",
    recall: { q: "A primary database in Mumbai replicates asynchronously to Frankfurt with about one second of lag, and Mumbai fails. What is lost, and what must you do before Frankfurt takes writes?", a: "Roughly the last second of committed writes (the RPO equals the replication lag) are missing in Frankfurt. Fence the old Mumbai primary so it cannot accept writes if it comes back, then promote Frankfurt and reroute users; otherwise you have two writers and unresolved conflicts." },
    archNodes: ["gateway", "dns"],
  },
  {
    slug: "cdn-internals", title: "CDN architecture in depth", moduleId: "infrastructure", level: "intermediate", minutes: 14,
    problem: "Static files are cached at the edge, yet the origin still melts under a viral object, personalised pages leak between users and a stale copy cannot be removed.",
    summary: "Inside a CDN, anycast routes users to the nearest edge, tiers and origin shields funnel misses, the cache key and Vary decide what is the same object, Cache-Control, stale-while-revalidate and purges decide how long it lives, and signed URLs and edge functions handle private content.",
    catTip: "Every house on the street has a bowl with my name on it, so I eat at the nearest one. If a bowl is empty, the neighbour checks one shared pantry instead of bothering the humans. One pantry, many bowls: that is an origin shield.",
    recall: { q: "A viral image expires at the same instant on 200 edges. Which two CDN mechanisms keep the origin from receiving thousands of simultaneous fetches?", a: "Request collapsing at each edge forwards one request per cache key and holds the identical ones until the response arrives, and an origin shield funnels the misses from all edges through one caching tier near the origin so it sees roughly one request per object." },
    archNodes: ["cdn"],
  },
  {
    slug: "cloud-networking", title: "Cloud networking: VPCs, subnets and load balancers", moduleId: "infrastructure", level: "intermediate", minutes: 14,
    problem: "Every server has a public address, the database answers the internet, and the one NAT gateway in zone a takes the whole fleet offline when that zone fails.",
    summary: "A VPC is your own address space in a region, split into public and private subnets per zone. Internet and NAT gateways decide who reaches out, security groups and network ACLs decide who gets in, and endpoints keep AWS traffic off the metered path.",
    catTip: "The front door is for visitors. The cat flap is for me going out, and it counts every trip and charges the humans per squeeze. I asked for one flap per room so a stuck door never traps the whole house. Granted, reluctantly.",
    recall: { q: "What makes a subnet public, and what do private subnets use to reach the internet?", a: "A subnet is public when its route table sends 0.0.0.0/0 to an internet gateway. Private subnets route outbound traffic to a NAT gateway in a public subnet, which is zonal and charges per gigabyte, so you want one per zone and gateway endpoints for S3 and DynamoDB." },
    archNodes: ["gateway"],
  },
  {
    slug: "iac", title: "Infrastructure as Code and delivery pipelines", moduleId: "infrastructure", level: "intermediate", minutes: 12,
    problem: "Environments built by clicking cannot be rebuilt, staging and production differ in ways nobody can list, and a manual console change silently diverges from what the team believes is deployed.",
    summary: "Infrastructure as Code keeps the environment as declarative files in version control, applied with Terraform, CloudFormation or Pulumi: plan before apply, a locked remote state mapping configuration to reality, modules per environment, and a pipeline or GitOps agent as the only route to production.",
    catTip: "I knocked the plant off the shelf again. The humans put it back exactly where the photo, the repository, says it goes, every single time. Annoying. Also correct: that is reconciliation, and I am drift.",
    recall: { q: "Two engineers run terraform apply against the same environment at the same moment. What protects the state file, and what happens without it?", a: "State locking: the backend locks the state for any operation that could write it, so the second run waits or fails. Without a lock both runs read the same state and the last write wins, leaving resources created by the other run orphaned and unknown to Terraform." },
    archNodes: [],
  },
];
