import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-vending-machine",
  title: "Design a vending machine",
  track: "lld",
  level: "intermediate",
  minutes: 30,
  scenario: "A vending machine has up to 40 slots, accepts ₹1 to ₹10 coins and ₹10 to ₹50 notes, dispenses one item per sale and returns change. The coin acceptor, the keypad, an operator console and an idle timer all send it events. It must never dispense without being paid, never keep money without dispensing or refunding, and come back to a sane state after a power cut mid-sale.",
  focus: "Letting what each button does depend on the machine's state without a status switch in every method, keeping money and stock outside the states, and ordering every check before the one irreversible step, the eject.",
  concepts: ["oop-pillars", "interfaces-abstractions-di", "design-patterns-behavioural", "concurrency-basics", "testing-extensibility"],
  steps: [
    {
      prompt: "What are the requirements, and which two invariants outrank everything else? What would you assume about customers and about how money is stored?",
      hint: "Think of the two ways the customer or the owner could lose out in a single sale. For assumptions, consider how many people can physically use the coin slot at once and what goes wrong when rupees are stored as floating point.",
      insight: "The machine never dispenses without being paid and never keeps money without dispensing or refunding. Assume one customer at a time (the slot and keypad are single-file), money as integer paise, fixed prices per slot and a refund after 60 seconds idle; card payments, telemetry and multi-item purchases are out of scope, with an interface left for cards.",
    },
    {
      prompt: "Name the machine's states and the events it receives. Is an empty slot a state of the machine?",
      hint: "Walk one successful sale and one refused sale, and note each point where pressing the same button starts to mean something different. Distinguish a condition of one slot from a condition of the whole machine.",
      insight: "Idle, HasMoney, Dispensing and OutOfService, driven by insert, select and cancel. A single empty slot is an inventory check inside HasMoney, not a state; OutOfService is entered only when every slot is empty or the hardware faults.",
    },
    {
      prompt: "How do you stop insert, select and cancel from each starting with a switch on the status? Justify your choice against the lighter alternative.",
      hint: "Count the states and events, then ask how much each state does beyond 'allowed or not': refusals with messages, refunds, compensation after a failed eject.",
      insight: "The State pattern: each state implements one VendingState interface, each method returns the next state, and the machine stores whatever it gets back. It earns its place because behaviour per state is substantial; an enum with a transition table answers 'is this allowed' but leaves refunds and compensation needing a home, which rebuilds the switch.",
    },
    {
      prompt: "Where do the inserted balance, the stock and the cash live: inside the state objects or somewhere else? What, then, does a state object hold?",
      hint: "Follow the balance through one sale and note which state creates it, which grows it and which consumes it. Data that must survive a transition needs a home that does not change at each transition.",
      insight: "The balance lives in a Transaction owned by the VendingMachine context, together with Inventory and CashRegister, so state objects hold no data and are interchangeable rule books. Dispenser and Display are interfaces over the hardware, so tests pass a fake that records ejects or throws on the third one.",
    },
    {
      prompt: "A customer inserts ₹20 and selects a ₹15 item. In what order do you run the checks and the steps of the sale, and what happens if the motor jams?",
      hint: "Find the one step nobody can undo. Everything that can refuse the sale should run before it; then ask what you would have to reverse if that step fails.",
      insight: "Check stock, then balance, then whether change can be made from the coins actually in the register, all before anything happens; then reserve the unit, eject, accept the money and pay out change. If the eject fails, release the reservation, mark the slot faulty and refund in full, so the sale never happened.",
    },
    {
      prompt: "How does the register decide whether it can give ₹6 in change? Is taking the largest coin that fits, repeatedly, always enough?",
      hint: "Greedy change-making is optimal for canonical coin systems with unlimited coins. A register only has the coins it holds: try one ₹5, no ₹1 and three ₹2.",
      insight: "Greedy can fail with a finite register: it takes the ₹5 and is stuck, while three ₹2 coins would do. Amounts are small, so a bounded search over denominations is the honest implementation, and canMakeChange and payOut must use the same algorithm or the check will approve change the pay-out cannot assemble.",
    },
    {
      prompt: "The idle timeout fires in the same instant the customer presses select. How do you guarantee the customer is not both refunded and served?",
      hint: "Name the shared state: the current state reference, the transaction, the inventory and the register. What is the simplest tool that makes one event run to completion before the next begins, and how should the timeout reach the machine?",
      insight: "The machine's three public methods are synchronized, and the timeout task simply calls cancel(), so it goes through the same lock and the same state logic as a button press. Whichever thread wins, the other arrives in Idle, where select only shows a price and cancel is a no-op; the cost is that the lock is held while the motor turns, which is what real machines do.",
    },
  ],
  tradeoffs: [
    "State classes vs an enum transition table: choose State here because each state has real behaviour (refusals, refunds, compensation); choose the table when states only decide allowed or not, as for a loan or a ticket.",
    "Synchronous dispense under the lock vs an asynchronous completion callback: choose synchronous for trivially provable race behaviour, accepting a keypad that is busy for the length of the eject.",
    "Check change before dispensing vs sort change out afterwards: choose checking first because it keeps both invariants, at the cost of more 'exact change only' refusals when the register runs low.",
  ],
  followUps: [
    "Power fails between the eject and the change. How does the machine decide what to do when it boots?",
    "Add card and wallet payments without editing the state classes.",
    "Where would telemetry events such as SaleCompleted go, and why publish them only after the lock is released?",
    "When would turning events into Command objects start to earn its place?",
  ],
};
