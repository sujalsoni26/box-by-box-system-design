import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-library-management",
  title: "Design a library management system",
  track: "lld",
  level: "intermediate",
  minutes: 30,
  scenario: "A library branch has about 50,000 titles, 200,000 physical copies and 10,000 members. Members search the catalogue, borrow and return at the desk, renew once, and reserve a title when every copy is out; loan limits and fines depend on the membership tier. Two desks must never lend the same copy, and a failed notification must never fail the loan it reports.",
  focus: "Separating the title a member searches for and reserves from the physical copy that is lent, held, lost and fined, and attaching every rule to the right one.",
  concepts: ["class-relationships-uml", "composition-over-inheritance", "solid", "design-patterns-behavioural", "concurrency-basics"],
  steps: [
    {
      prompt: "What are the core use cases and the rules that constrain them? State the numbers you would assume.",
      hint: "Think from the member's side (search, borrow, return, renew, reserve) and the library's side (limits, fines, lost copies). Which rules change with the member's tier?",
      insight: "Search by title, author or ISBN with copy availability; borrow a scanned copy, return, renew once if nobody is waiting; reserve into a first-in, first-out queue with a three-day hold; tier-dependent limits and fines (5 loans and a ₹200 fine block for ordinary members); notifications. One branch in one process, a 14-day loan, money in paise and dates from an injected Clock; payments, transfers between branches and e-books are out.",
    },
    {
      prompt: "A first draft has one Book class with a status field. Which requirement breaks it, and how would you remodel?",
      hint: "Try to express 'all three copies of this title are out, put me in the queue' with one status per Book. What does a member wait for, and what do they actually carry home?",
      insight: "Split Book (the title: ISBN, title, authors) from BookCopy (barcode, status, who it is held for). Search and reservations attach to the Book, because a member waits for a title; loans, status, holds and fines attach to the BookCopy, because only a physical item can be out, late or lost.",
    },
    {
      prompt: "Who runs the use cases and is allowed to change a copy's status, and how do the remaining classes divide along stakeholder lines?",
      hint: "Cataloguers, the circulation desk and the finance committee each change different things. Which one class should enforce the borrowing rules, and which pieces vary with the membership tier?",
      insight: "Catalogue owns books and the search index; a LendingService runs borrow, return, renew and reserve and is the only class that changes a copy's status; Loan and Reservation record the facts, and ReservationQueue is a FIFO per title. The tier-dependent rules sit in FinePolicy and LendingPolicy, so the finance committee's changes never touch lending code.",
    },
    {
      prompt: "Notifications, audit and statistics all want to hear about loans, and fine rules differ by tier. Which patterns fit, and should copy status become State classes?",
      hint: "One concern is swapping an algorithm, another is telling parties you do not know about that something happened. For copy status, ask what each status actually decides.",
      insight: "FinePolicy and LendingPolicy are Strategies; LibraryListener is an Observer that receives LoanCreated, HoldReady and LoanOverdue, so a new channel edits nothing. CopyStatus stays an enum because each status only answers 'may this copy be lent', and the catalogue is not a Singleton, because LendingService should declare it in its constructor.",
    },
    {
      prompt: "A copy comes back late while two members are queued for its title. Walk through what happens, including what happens if the first member never collects it.",
      hint: "A return produces three things: a fine, a new status for the copy and a message. Then think about a timer, and what it must check again before it acts.",
      insight: "The return (giveBack) computes the fine through the FinePolicy, closes the loan and adds the fine to the member, then puts the copy on hold for the first reservation, schedules a three-day expiry and publishes HoldReady. The expiry task re-checks under computeIfPresent that the copy is still on hold for that member before passing it on, so a hold already collected does nothing and a task that runs twice is harmless.",
    },
    {
      prompt: "Two desks scan the same barcode within milliseconds. How do you guarantee one loan, and what smaller race remains around the member's loan limit?",
      hint: "You need the check of the copy's status and the change to ON_LOAN to happen as one step for that barcode. Look at what ConcurrentHashMap offers beyond get and put, and what it forbids inside that call.",
      insight: "The status check and the change to ON_LOAN run inside one ConcurrentHashMap.compute for that barcode, so one desk wins and the other throws; a function that throws leaves the map unchanged, and BookCopy is immutable so readers never see half an update. The member checks run outside compute, because the function must be short and must not modify the map, so a member at two desks in the same second could exceed the limit by one: say so, then accept it or make Member.tryAddLoan the atomic check.",
    },
  ],
  tradeoffs: [
    "A status field on the copy vs availability derived from open loans and holds: choose the field for one-lookup answers, accepting that it is a cache that must change in step with loans; derive it when you want one source of truth and a queryable history.",
    "FIFO reservations vs a priority rule: choose FIFO because it is fair and explainable; letting staff jump the queue needs a second policy.",
    "Synchronous listeners vs a queue and a worker: choose synchronous listeners, each isolated in its own try, while volume is low; move to a queue when a slow channel starts to slow the desk.",
  ],
  followUps: [
    "Remove the status field and derive availability instead. What now stops two open loans for the same copy?",
    "How would the design change for several branches?",
    "The overdue sweep runs twice in one day. How do you avoid notifying a member twice?",
    "Add DVDs and magazines. Which classes change, and which do not?",
  ],
};
