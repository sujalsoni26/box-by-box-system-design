import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-whatsapp",
  title: "Design WhatsApp",
  track: "hld",
  level: "advanced",
  minutes: 45,
  scenario: "Design WhatsApp messaging: one-to-one chats and groups of up to 1,024 members, delivery to phones that are offline, sent, delivered and read ticks, presence, and end-to-end encryption so the server never holds a readable copy. Assume 1B daily active users sending 100B messages a day, with 500M devices connected at peak.",
  focus: "About 33M deliveries a second at peak, routed to 500M persistent connections on roughly 500 gateways: group fan-out turns 1M sends a second into 11M deliveries and 22M receipts. Storage is an afterthought.",
  concepts: ["websockets", "message-queues", "idempotency", "consistency", "time-and-ordering", "encryption", "design-notification-system"],
  steps: [
    {
      prompt: "What should each tick promise, and which non-functional requirements shape the server more than any single feature?",
      hint: "Ask what one tick must guarantee if a server crashes a second later, how messages must be ordered, and what end-to-end encryption forbids the server from doing.",
      insight: "One tick means the server holds a durable copy, two ticks mean the recipient's phone has it, and blue means it was read; messages are ordered per conversation and arrive within 500 ms between online phones. The server stores only ciphertext, which rules out server-side history, search, link previews and content-based spam filtering, while presence may be stale.",
    },
    {
      prompt: "With 100B messages a day, 20% of them to groups averaging 50 members, estimate deliveries, receipts, gateways and inbox storage. What is the dominant number?",
      hint: "Count deliveries, not sends: groups multiply. Each delivery produces two receipts. Assume a gateway holds 1M connections and that most inbox entries are deleted within minutes.",
      insight: "1M sends a second become about 11M deliveries and 22M receipts, or 33M deliveries and about 100M frames a second at peak, across 500M connections on roughly 500 gateways. The live inbox is only about 100 TB and media is a bandwidth bill for object storage and a CDN, so the problem is routing a write-heavy stream of tiny messages with a fan-out multiplier, not storage.",
    },
    {
      prompt: "What durable message state does the server keep, and how does a phone talk to it?",
      hint: "The server cannot read messages, so what could a messages table contain? Think in terms of what a device has not yet acknowledged, and how the server finds one connection among half a billion.",
      insight: "Each device holds one persistent connection to a stateless gateway that carries send, ack, receipt and presence frames, with HTTP kept for sync, media upload and keys. The only durable message state is a per-device inbox of undelivered envelopes in an LSM store with a 30-day TTL, deleted on acknowledgement, plus a per-chat row that mints sequence numbers and an in-memory session registry mapping each device to its gateway. There is no messages table and no per-recipient receipt table.",
    },
    {
      prompt: "A message arrives for B. In what order do you write, acknowledge and push, and what happens if B reconnects to a different gateway while the push is in flight?",
      hint: "Decide what must be true before A sees one tick. Then walk through a push to the old gateway racing a reconnect and drain on the new one. Which outcomes are safe?",
      insight: "Write the envelope to inbox(B) on two of three replicas, then acknowledge A (one tick), then look up the registry and push; a registry miss wakes the phone through APNs or FCM with no content. Every race is safe because the inbox is the truth: a dead socket leaves the envelope for B's next drain, and a double delivery is discarded on msg_id. The push is an optimisation; the inbox plus the drain is the protocol.",
    },
    {
      prompt: "With pairwise encryption, a photo sent to a 1,024-member group would need 1,024 encryptions and uploads. How do you avoid that, and should the server fan out on write or on read?",
      hint: "Could the members share a key for the group? Consider what must happen when someone leaves, and compare a family group where everyone reads with a huge channel most subscribers never open.",
      insight: "Use the Signal protocol's Sender Key: distribute it once over the pairwise sessions, then encrypt each message once while the server writes it into every member's inbox; media is one encrypted blob uploaded once, with its key sent inside the message. Fan-out on write suits groups where everyone reads, while huge announcement channels flip to a per-channel log members pull. A member leaving forces everyone to re-key, which is why groups are capped.",
    },
    {
      prompt: "How do all devices in a chat agree on message order, and how do delivered and read ticks reach the sender without a per-message, per-member table on the server?",
      hint: "Phone clocks disagree. Who could hand out numbers for one chat, and what must happen to them on failover? What if receipts travelled the same way messages do?",
      insight: "The chat shard that owns chat_id mints a per-chat sequence number from a replicated counter; numbers may skip after a failover but are never reused, and client_msg_id makes a retried send get the same number back. Delivered and read receipts are ordinary envelopes routed into the sender's inbox, and the sender's phone counts them (in a group, the second tick appears once every member has delivered), so the server knows only what is undelivered.",
    },
  ],
  tradeoffs: [
    "Inbox first vs push first: write to the inbox first, because 'sent' is a promise; push-first is cheaper but loses the message if a gateway accepts the push and dies before the phone acknowledges.",
    "Fan-out on write vs on read for groups: write to member inboxes while members actually read; switch to a per-channel log that members pull for huge channels most never open.",
    "Server-side history vs ciphertext only: keep only ciphertext, and accept no server-side search, previews or recovery without a client-side backup.",
    "Persistent connections vs polling: at 500M devices, polling every 5 s would be 100M mostly empty requests a second, while keepalives answered on the gateway are the cheapest traffic in the system.",
  ],
  followUps: [
    "A gateway holding a million connections dies. What happens to those phones and to messages sent meanwhile?",
    "How can abuse be detected when the server cannot read any content?",
    "What multiplies when a user adds a laptop and a tablet as companion devices?",
    "Why does a message to someone who stays offline for more than 30 days keep one grey tick forever?",
  ],
};
