import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-food-ordering",
  title: "Design a food-ordering system",
  track: "lld",
  level: "advanced",
  minutes: 50,
  scenario: "Customers fill a cart from one restaurant, apply a coupon and check out; the order then moves through placed, accepted, preparing, ready, picked up and delivered, while a restaurant, a payment provider and a delivery partner can each say no after you have said yes. Assume one city, 2,000 restaurants and 20,000 orders an hour at peak. A customer must never be charged twice, a placed order's totals must never change when the menu does, and a rejection after payment must always end in a refund.",
  focus: "Separating the mutable cart from an immutable order priced once in paise, making payment a separate idempotent step, and treating every failure after payment as a compensating refund rather than a rollback.",
  concepts: ["design-patterns-behavioural", "error-handling", "idempotency", "sagas", "lld-task-scheduler", "lld-ride-booking"],
  steps: [
    {
      prompt: "Three outside parties can each refuse after you have committed. Which non-functional requirements matter most, and what do you assume?",
      hint: "Look at the customer's money from three angles: charged twice, charged a different amount from the one they saw, and charged for food that never arrives.",
      insight: "Never charge twice for one checkout, never change a placed order's totals when the menu changes, keep money arithmetic exact, and always refund a rejection after payment, even when the first refund call fails. Assume one city and one process, prices in paise, a provider that honours idempotency keys and a restaurant that must answer within 3 minutes; search, maps and multi-restaurant carts are out.",
    },
    {
      prompt: "A cart can sit for twenty minutes while prices and availability change under it. What does the cart store, and what does the order store?",
      hint: "Think of a scratchpad and a receipt. Which one should re-read the menu, and which one should be immune to it?",
      insight: "The cart stores only the restaurant id, item ids, quantities and a coupon code, and at checkout produces a CartSnapshot that re-reads prices and availability and reports any problems. The order is an immutable aggregate that copies names and unit prices into OrderItems with frozen totals, so later menu edits cannot touch what the customer agreed to pay.",
    },
    {
      prompt: "How do you represent money and compute subtotal, discount, tax and total so that rounding happens in one controlled place?",
      hint: "Use exact integers wherever there is no fraction. Where is there a genuine fraction, and how many times should you round?",
      insight: "Money is a record of long paise with overflow-checked arithmetic and a constructor that rejects negatives; BigDecimal appears only in percent(), built from strings and with a named rounding mode such as HALF_EVEN. Totals are computed once from the snapshot, with the tax on the discounted subtotal as the single rounding step back to whole paise.",
    },
    {
      prompt: "Checkout may find an unavailable item, may have the card declined, or may succeed, and the customer may tap Pay twice. How do you model the outcomes and stop a double charge?",
      hint: "Are these outcomes failures that stop the operation, or results the app branches on? For the double tap, think about who generates the key, where you record it, and who else honours it.",
      insight: "Checkout returns a sealed CheckoutResult (Placed, NeedsAttention or Declined) rather than throwing, because the app branches on all three. A client-generated idempotency key, reserved with putIfAbsent in ordersByKey before the gateway call, hands the existing order back to a retry, and the same key goes to the gateway, which protects the money even if the process dies between the charge and saving the order.",
    },
    {
      prompt: "Draw the order's lifecycle with every exit. What should happen if the restaurant stays silent for three minutes, and what if its acceptance races that timer?",
      hint: "Count the states and the behaviour per state, then choose between State classes and a table. For the timer, think of a one-shot job and what an illegal transition tells it.",
      insight: "Placed, Accepted, Preparing, Ready, PickedUp and Delivered, with Rejected and Cancelled as exits, kept as an enum transition table like the trip in ride booking. An AutoReject one-shot on the scheduler tries to move the order to Rejected after 3 minutes; if the restaurant has accepted meanwhile the transition is illegal, and the job treats that specific exception as 'nothing to do'.",
    },
    {
      prompt: "The restaurant rejects an order whose payment has already been captured. What does the system do, and what if the first refund call fails?",
      hint: "You cannot roll back a captured payment; you can only perform something that undoes its effect. Think of the scheduler from the earlier case study, and what makes running the same job twice safe.",
      insight: "The order moves to Rejected and a RefundPayment Task is scheduled with retries and backoff, using 'refund-' plus the payment key so running it twice refunds once. After the maximum attempts it is Failed on the scheduler and lands in an operator queue, so the money is never silently forgotten: a compensation, the in-process shape of a saga, not a rollback.",
    },
    {
      prompt: "Name the shared mutable state and the cheapest correct tool for each: menu availability, carts, order state, delivery partners, kitchen capacity and coupon redemptions.",
      hint: "Look for a flag with one writer, objects with one owner, a lock per aggregate, a single contested field, a counted capacity, and a claim that should succeed only once.",
      insight: "Availability is a volatile flag; a cart's methods are synchronized for the rare two-device edit; order state is guarded by the order's own monitor; a partner is claimed with compareAndSet(Available, Assigned) exactly like a driver; kitchen capacity is a Semaphore per restaurant using tryAcquire, so a full kitchen answers 'busy' instead of blocking. A coupon redemption is a putIfAbsent claim on code plus customer, released if the order is rejected or cancelled.",
    },
  ],
  tradeoffs: [
    "Charge at checkout vs authorise at checkout and capture on acceptance: choose charging while rejections are rare, because one path is simpler; choose authorise-then-capture when rejections are common, because a void is cheaper than a refund, accepting that the capture can itself fail.",
    "A refund as a retried Task vs an inline call: choose the Task because a refund is then never forgotten and is auditable, accepting that a failed refund is a job to watch rather than an exception to catch.",
    "An enum table vs State classes for OrderState: choose the table because per-state behaviour is small and a dozen lines with an exhaustive switch cover it; promote to classes when that behaviour grows.",
    "Assign the partner at acceptance vs at ready: choose by the gap between predicted preparation time and partner ETA, because early assignment idles the partner when the kitchen is slow and late assignment leaves food waiting; the rule lives in the assignment strategy.",
  ],
  followUps: [
    "The payment call times out and the outcome is unknown. What must the service never do, and what does it do instead?",
    "The process dies after the charge but before the order is saved. How is the customer's money recovered?",
    "Payment, restaurant and delivery become separate services. What does the compensation logic turn into?",
    "Allow two coupons on one order. How would you model it?",
  ],
};
