import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-splitwise",
  title: "Design an expense-sharing app like Splitwise",
  track: "lld",
  level: "intermediate",
  minutes: 30,
  scenario: "Friends in a group record shared expenses: who paid, how much, who it was for, and whether to split equally, by exact amounts or by percentages. The app shows who owes whom, records settlements, and can simplify a group's debts into fewer payments. Every paisa must be accounted for, and the history must be trustworthy enough to rebuild every balance from it.",
  focus: "Producing shares that sum exactly to the amount in integer paise, deriving balances from an immutable append-only ledger, and stating honestly what the greedy debt simplification does and does not minimise.",
  concepts: ["oop-pillars", "solid", "design-patterns-behavioural", "error-handling", "event-sourcing"],
  steps: [
    {
      prompt: "Beyond the features, which correctness properties would you promise about money and about history? What type do you store amounts in?",
      hint: "Split ₹1,000 three ways using doubles and add the shares back up. Then think about what editing last week's expense should do to everyone's balance, and to trust in the history.",
      insight: "The shares of an expense always add up to its amount, a group's net balances always sum to zero, and history is immutable: an edit or a delete is a new entry that reverses an old one. Money is a long number of paise, because a double cannot hold most decimal fractions exactly and its errors accumulate over a year of expenses.",
    },
    {
      prompt: "List the entities. Which one guards the central invariant, and where exactly does that check run so that nothing downstream ever needs to repeat it?",
      hint: "Think of an object that refuses to exist in an invalid state. Java records have a natural place to put that refusal.",
      insight: "User, Group, Expense, Share, Settlement, ExpenseLedger, BalanceSheet, DebtSimplifier and ExpenseService. Expense is an immutable record whose compact constructor rejects shares that do not sum to the amount and copies the list defensively, so the ledger and the balance sheet only ever see valid expenses.",
    },
    {
      prompt: "How do you structure equal, exact and percentage splits, and where does the leftover paisa go when ₹1,000 is split three ways? Is an equal split just a percentage split at 33.33 percent?",
      hint: "Each split type changes for its own reason. The rounding answer must come out the same on every replay. Consider storing percentages as integers too.",
      insight: "Each split is a SplitStrategy class. EqualSplit gives amount divided by n to everyone and hands the leftover paise one each to the first participants in a fixed order (33334, 33333, 33333), so a replay gives the same answer; PercentSplit uses basis points that must total 10,000, floors each share and hands out leftovers in order. Equal split is its own class because a third is 3,333.33 basis points.",
    },
    {
      prompt: "How do you compute who owes whom, and what happens when a member edits an expense from last week?",
      hint: "Treat the ledger as the only truth. When an expense is applied, what is the payer credited, and what is each participant, the payer included, debited?",
      insight: "Balances are a fold over the append-only ledger: the payer is credited the whole amount and every participant is debited their share, so net balances sum to zero after every apply, an invariant worth asserting in tests. An edit appends a reversing entry and the corrected expense, so balances can always be rebuilt and the history shows both.",
    },
    {
      prompt: "Design 'simplify debts' for a group. What does your algorithm guarantee, and what does it not?",
      hint: "Work from net balances, not the pairwise history, and pair people by size. Then test your answer on balances of +400, +300, −200, −200 and −300.",
      insight: "Greedy: repeatedly settle the largest creditor against the largest debtor using two max-heaps, which ends within n − 1 transfers in O(n log n) and moves the minimum total money. It does not guarantee the fewest transfers: on the example it needs four where three suffice, and exact minimisation means partitioning people into zero-sum groups, which is NP-hard, so greedy is the answer to ship for a group of friends.",
    },
    {
      prompt: "Two members add expenses to the same group at the same moment, and a flaky phone retries addExpense. What do you need to lock, and how do you stop the retry counting twice?",
      hint: "Does the order in which two ledger entries are applied change the final net balances? What would make a retried request recognisable as one you have already seen?",
      insight: "The ledger is append-only and net balances are a sum, so order does not matter and replay in any order gives the same result; only a cached balance needs a per-group lock or a version column. A client-generated expense id makes the retry idempotent, because the ledger ignores a duplicate id, and simplification reads a snapshot and needs no lock.",
    },
  ],
  tradeoffs: [
    "Integer paise vs BigDecimal: choose long paise for exact sums and trivial equality; BigDecimal with an explicit scale and rounding mode is still needed for interest or three-decimal currencies.",
    "Derived balances vs stored balances: choose derivation from the ledger for consistency and auditability, then cache per group because replay cost grows with history.",
    "Greedy simplification vs exact minimisation: choose greedy because it is fast and minimises the money moved; finding the fewest transfers exactly is exponential in group size.",
    "Strategy classes vs an enum switch inside Expense: choose Strategy so each split is tested alone and new types need no edits, at the cost of more files for a fixed set of three.",
  ],
  followUps: [
    "Support an expense paid by two people. Which classes change, and which stay untouched?",
    "Work through the five-person example where greedy needs an extra transfer, and explain why the exact problem is hard.",
    "A member tries to settle more than they owe. What do you do, and why?",
    "How would you support several currencies?",
  ],
};
