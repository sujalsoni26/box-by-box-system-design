import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 15: Low-Level Design: Foundations, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Low-Level Design: Foundations
  "lld-intro": {
    breaks: "Without a low-level design, the first developer to open the box invents the classes under deadline, responsibilities land wherever the cursor was, and every later change means reading the whole component to find out who owns what.",
    tradeoffs: "Every class, interface and pattern is a boundary that must be named, understood and tested, so more structure buys flexibility at the price of indirection and more files to read.",
    explainSimply: "High-level design decides which buildings a campus needs and which roads join them. Low-level design is the floor plan of one building: which rooms exist, what each is for, and which doors connect them. You settle the rooms before anyone lays a brick.",
    hint: "List the artefacts in the order you would draw them on a whiteboard, then the four things a reviewer would tick off.",
  },
  "oop-pillars": {
    breaks: "Without encapsulation and abstraction every rule is enforced at the call site, so a negative balance or a vendor-specific exception leaks into the whole codebase and each new type adds another branch to every switch.",
    tradeoffs: "Hiding state and dispatching through interfaces adds indirection: an operation spread across many classes is harder to read than one switch, and an interface for a single implementation is ceremony.",
    explainSimply: "Think of a vending machine. You press a button and a drink appears; you cannot reach into the coin box, and you do not know whether a spiral or a belt moved the can. Objects work the same way: they hide their insides and promise only what their buttons do.",
    hint: "Which pillar is about who may change an object's state, and what single sentence should the fix guarantee?",
  },
  "class-relationships-uml": {
    breaks: "Without a shared notation for ownership, lifetime and count, two developers read 'the order has lines' differently, and one of them writes code that orphans or deletes data the other expected to keep.",
    tradeoffs: "Diagrams take time to draw and go stale as code changes, so draw only the classes, relationships and one or two flows that carry a decision.",
    explainSimply: "A class diagram is a family tree plus an address book: who is a kind of whom, and who keeps whose number. A sequence diagram is the transcript of one phone call, read top to bottom. The first says who knows whom; the second says who called whom, and in what order.",
    hint: "A filled versus a hollow diamond is about whether the parts survive the whole; then read each number at the far end of the line.",
  },
  "composition-over-inheritance": {
    breaks: "A subclass inherits its parent's internals as well as its contract, so a parent that calls its own overridable methods, or gains a method in the next release, silently changes what the subclass does.",
    tradeoffs: "Composition costs forwarding boilerplate, an extra object to construct and wire, and one more interface to read, which is pure overhead when the behaviour never varies.",
    explainSimply: "Extending a class is like building your extension on a neighbour's foundation: when they re-lay the floor, your walls crack. Holding the class in a field is like building next door with a corridor between the houses: you only depend on where their front door is. The corridor still breaks if they move the door, but not when they redecorate.",
    hint: "Who calls the overridden add when addAll runs, and whose code does the wrapper version call instead?",
  },
  "solid": {
    breaks: "Without a rule for where code belongs, every change ripples: three teams edit one class, each new case reopens working code, subclasses surprise their callers and tests need real infrastructure.",
    tradeoffs: "Each principle adds a class, an interface or a layer of indirection, which is pure overhead until the second case or the second team shows up.",
    explainSimply: "Think of a well-run kitchen: one cook per station, a new dish is a new recipe card rather than a rewritten menu, any trained cook can cover any station without the diners noticing, the waiter's pad shows only what the waiter needs, and the head chef asks for 'a fridge' rather than one brand of fridge. SOLID is those five habits, for code.",
    hint: "Ask who constructs the store and which way the dependency arrow points, then name the principle about arrows.",
  },
  "interfaces-abstractions-di": {
    breaks: "A class that constructs its own collaborators cannot be tested without them, hides what it depends on, and has to be edited whenever the database, the mailer or the clock changes.",
    tradeoffs: "Someone must now build and wire the object graph, either by hand in a composition root or with a container that hides the graph and moves wiring errors to runtime.",
    explainSimply: "A good chef does not build the oven; the kitchen is fitted out before service and the chef just cooks. Dependency injection fits a class out with what it needs before it does any work, from one place near the front door. Swap the oven and the recipe does not change.",
    hint: "Three places: where the contract is declared, how it arrives, and the single spot that knows the real class.",
  },
  "design-patterns-creational": {
    breaks: "Without a creational pattern the class that uses an object also decides its concrete type, so every new type edits working code and no test can substitute a fake.",
    tradeoffs: "Every pattern adds at least one interface and one class, and a Singleton's convenient global access hides dependencies and makes tests order-dependent.",
    explainSimply: "Instead of making every part of a program build the things it needs, you hand the building to a specialist. It is like ordering at a restaurant counter: you say what you want, and the kitchen decides who cooks it and how. The program only has to know what it asked for.",
    hint: "Think about what must stay consistent across several objects, not just how one object gets created.",
  },
  "design-patterns-structural": {
    breaks: "Without these patterns, vendor APIs leak into business logic, cross-cutting concerns such as retries and metrics get copied into every method, and tree-shaped data needs a special case for every level.",
    tradeoffs: "Each wrapper is another layer to read, debug and keep consistent, identity checks on wrapped objects break, and a facade can quietly grow into the class that does everything.",
    explainSimply: "These patterns are ways of putting one object inside another so the outside world sees a tidier shape. A travel plug changes the socket shape, a phone case adds protection without changing the phone, and a receptionist decides who gets through to the manager. Same move, three different reasons.",
    hint: "The shape is identical; think about the reason the wrapper was written.",
  },
  "design-patterns-behavioural": {
    breaks: "Without these patterns, algorithms, lifecycles and notifications are hard-coded as conditionals and direct calls, so every new rule edits working code and nothing can be tested alone.",
    tradeoffs: "Each pattern trades a conditional for more classes and indirection, and Observer adds hidden control flow whose ordering and failure behaviour are easy to get wrong.",
    explainSimply: "These patterns are about who does what, and who needs to know. Instead of one big recipe full of 'if this customer, do that', each rule becomes its own small card you can swap in. A restaurant order slip is one such card: it can be queued, handed on or cancelled.",
    hint: "Think about where the rules for one status live now, and where they would live if each status were a class.",
  },
  "concurrency-basics": {
    breaks: "Shared mutable state without coordination produces wrong counts, corrupted collections and flags that other threads never see, and the bugs appear only under load and vanish in the debugger.",
    tradeoffs: "Locks cost contention and risk deadlock, atomics cover only one variable, immutability costs copies, and bounded pools and queues force you to decide what happens when they are full.",
    explainSimply: "When two people edit the same sticky note at once, one edit gets lost. You can give each person their own note, use a note that updates in one stroke, or have one pen that only one person holds at a time. Trouble starts when two people each hold a pen the other needs.",
    hint: "Count the steps hidden inside the ++ and ask what another thread can do between them.",
  },
  "error-handling": {
    breaks: "Errors that are swallowed, returned as null or logged without context surface far from their cause, let callers continue on bad state, and turn a transient timeout into a double charge when retried blindly.",
    tradeoffs: "Result types make every call site unwrap and change when outcomes are added, exceptions hide control flow, and retries cost duplicate work unless the operation is idempotent.",
    explainSimply: "Decide in advance what happens when something goes wrong, instead of letting it happen somewhere random. Check inputs once at the door, like airport security, and trust them inside. When something fails deeper in, pass the problem up with a note attached rather than hiding it.",
    hint: "Think about whether the caller will branch on the outcome or cannot continue at all.",
  },
  "clean-code": {
    breaks: "Code that hides its intent behind short names, magic numbers and flags is misread by the next person, so changes take longer and introduce bugs a clear name would have prevented.",
    tradeoffs: "Extracting and naming everything can fragment a simple algorithm into many tiny hops, so every rule here bends to the question of what the reader would rather see.",
    explainSimply: "Write code the way you would write a good recipe: ingredients named up front, steps at the same level of detail, and a note explaining the one odd instruction. The person cooking next is probably you in a year, and you will not remember why 0.82.",
    hint: "Think about what the call site reads like, and whether a true in it tells the reader anything.",
  },
  "testing-extensibility": {
    breaks: "Code that reaches for the real clock, real databases and global singletons can only be tested slowly and end to end, so bugs are found late and refactoring is feared.",
    tradeoffs: "Every seam is an interface and a double to maintain, and tests that mock every interaction become a second copy of the implementation that breaks on every refactor.",
    explainSimply: "A unit test tries one small part of a program on its own, with the slow or unpredictable bits swapped for stand-ins, the way a film uses a stunt double for a dangerous scene. Design that allows the swap also allows new features to be added without touching what already works.",
    hint: "Think about what the class reaches for on its own, and what it could be handed instead.",
  },
};
