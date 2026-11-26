import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "design-ecommerce",
  title: "Design an e-commerce platform",
  track: "hld",
  level: "advanced",
  minutes: 50,
  scenario: "Design an e-commerce platform like Flipkart: shoppers browse 100M listings, keep a cart, check out with cards, UPI or cash on delivery, and must get exactly one order for exactly one payment. Plan for 50M daily shoppers, a festival sale at twenty times a normal day, and a flash sale of 10,000 phones with 2M shoppers pressing buy in the same minute.",
  focus: "Two different problems: about 230k catalogue reads a second on sale day, a caching and CDN problem, and about 33k buy attempts a second against one row holding 10,000 units, a correctness problem that no sharding fixes.",
  concepts: ["caching", "cdn", "rate-limiting", "idempotency", "distributed-transactions", "sagas", "design-key-value-store"],
  steps: [
    {
      prompt: "Which requirements concern correctness and which concern availability, and how do they differ between browsing, the cart and checkout?",
      hint: "Think about overselling, a double charge, a product page during a slow checkout, and a shopper who cannot add an item. Is a fast checkout that oversells acceptable?",
      insight: "Never confirm more units than exist, and keep exactly one order per payment and one payment per order. Catalogue reads stay under 300 ms and available even when checkout is strained, the cart is always writeable, the system survives a 20× sale, and checkout is correct before it is fast.",
    },
    {
      prompt: "Estimate page views on sale day, orders per second and the flash-sale buy rate. Which numbers dominate, and why are they different kinds of problem?",
      hint: "50M shoppers × 20 views a day, then ×20 on sale day. 2M shoppers in 60 s for 10,000 units. Compare that with the few thousand serialised updates a second one database row can take.",
      insight: "About 230k page views a second on sale day is a caching and CDN problem, and about 33k buy attempts a second against one row with 10,000 units is a correctness problem that no sharding fixes, because the contested thing is one number. Orders, about 230 a second, and 5 TB over seven years fit one PostgreSQL primary with replicas.",
    },
    {
      prompt: "How would you split the system into services, what should POST /checkout return, and which constraints in the data model carry the requirements?",
      hint: "Group data by its consistency rule. Payment may take seconds for a card or minutes for UPI. Look for one database rule each for overselling, duplicate orders and duplicate charges.",
      insight: "Four services with four stores: a cached catalogue, an inventory that reserves, commits and releases stock, an order service that runs checkout, and a payment service that alone talks to the provider. POST /checkout returns 202 with a PENDING order. In the data, reserved <= on_hand stops overselling, a UNIQUE idempotency_key on orders gives one order per click, and a UNIQUE provider_ref gives one payment row per provider charge, while availability is a separate endpoint cached for seconds.",
    },
    {
      prompt: "Order, inventory and payment cannot share a transaction. How does checkout stay correct when a payment response is lost or a webhook arrives twice?",
      hint: "Why can a payment provider not take part in two-phase commit? Order the steps so the risky one is the pivot, and look for a key that makes every retry identical to the original.",
      insight: "Run checkout as a saga: create a PENDING order under the client's idempotency key, reserve stock with a 10-minute TTL, charge with the order id as the provider's idempotency key, then confirm, or release the reservation on decline. A lost response is retried with the same key, a duplicate webhook hits the unique provider_ref, and a reconciler fetches stuck PENDING payments, keeping orders open because a failed payment can be authorised days later.",
    },
    {
      prompt: "Two million shoppers want 10,000 phones in one minute. How do you protect the inventory row and still sell every unit exactly once?",
      hint: "Work through four layers: who gets in, what can say no cheaply before the database, how long a winner may hold a unit, and how abandoned units come back.",
      insight: "A virtual waiting room admits a bounded number of shoppers a minute, with random admission as the fairer option; an atomic Redis DECRBY counter seeded with 10,000 lets only potential winners reach PostgreSQL; each winner reserves with a short TTL, one hold per shopper; and a sweeper returns expired holds to sale. The database should only ever see requests that can succeed, and the row's reserved <= on_hand check catches the few a counter over-admits after a failover.",
    },
    {
      prompt: "How do you serve 230k product-page views a second, and where does the cart live?",
      hint: "Separate what changes rarely from what changes every second. Watch for hundreds of hot cache entries expiring together. Does a cart need transactions, or does it need to accept every write?",
      insight: "Cache the page shell at the CDN for a minute with stale-while-revalidate, version images for a year, fetch availability separately for seconds, protect hot products with TTL jitter and single-flight rebuilds, and feed search by change data capture about a second behind. The cart is a Redis hash with a 30-day expiry re-set on every write and is merged by union at login: always writeable, Dynamo-style.",
    },
  ],
  tradeoffs: [
    "Reserve then pay vs pay then allocate: reserve first for scarce items such as the flash-sale phone; pay first for abundant bestsellers, where a rare refund is cheaper than holding stock.",
    "Two-phase commit vs a saga: a saga, because a payment provider cannot prepare and locks held across a 3 s provider call would stall the inventory row for everyone.",
    "A counter gate vs bucketed stock: a counter gate for scarce drops; buckets for items that are hot but not scarce, accepting that an empty bucket may refuse a shopper while another bucket still has units.",
    "Cached availability vs live inventory: the cache may lie a little on the page, but nothing on the checkout path reads a cache to make a decision.",
  ],
  followUps: [
    "A payment is marked failed, and the bank authorises it three days later. What should the system do?",
    "In what order would you switch features off if the platform is overloaded on sale day?",
    "How do you make sure a tampered price in a request is never charged?",
    "At 10×, what changes in inventory and in the checkout saga?",
  ],
};
