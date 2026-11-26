import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-logging-framework",
  title: "Design a logging framework",
  track: "lld",
  level: "intermediate",
  minutes: 35,
  scenario: "Design the logging library every class in an application calls: named loggers with five levels inherited down a dotted-name hierarchy, several destinations each with its own format and filters, per-request context on every line, and an asynchronous mode. Peak load is around a hundred thousand events a second. A disabled call must allocate nothing, a logging call must never throw, and a slow disk must never make a payment thread wait.",
  focus: "Separating whether to log (one comparison), where it goes, how it looks and the exceptions to the rule, so the fast path costs nothing and asynchrony becomes one wrapper with an explicit full-queue policy.",
  concepts: ["design-patterns-creational", "design-patterns-structural", "design-patterns-behavioural", "concurrency-basics", "backpressure", "logging"],
  steps: [
    {
      prompt: "Every library in the application depends on the logger. Which non-functional requirements follow from that, and what do you leave out of scope?",
      hint: "Think about the cost of a call that writes nothing, what a full disk should do to business code, and what overload should do to events of different severity.",
      insight: "A disabled call costs a method call and a comparison and allocates nothing; a logging call never throws; a slow or broken destination slows or breaks only itself; and under overload the framework states what it drops, with WARN and ERROR going last. Shipping, indexing and searching logs is the system-level concern and stays out.",
    },
    {
      prompt: "A naive Logger.log() does everything in one method. Which separate questions is it answering, and which object should own each one?",
      hint: "Follow one call from the call site to bytes on disk and note each decision made on the way. Which of those decisions would change if you added a second destination, a JSON format, or a rule that mutes one noisy class on the console only?",
      insight: "The Logger decides whether, by comparing the requested level with its effective level; an Appender decides where; a Layout decides the text; a chain of Filters handles exceptions per appender. The logger knows nothing about files, so a new destination never touches the class every call site uses, and an appender can be tested with a hand-built event.",
    },
    {
      prompt: "A logger named payments.Refund has no level of its own. How does it decide whether to log, and at what point do you create the LogEvent?",
      hint: "Walk up the dotted names. Then picture a DEBUG call in a hot loop while the application runs at INFO, and count the allocations.",
      insight: "Its effective level is the first level set walking up its ancestors by dotted name (production frameworks cache this per logger and refresh it when a level changes). The LogEvent, with its context snapshot, is built only after isEnabled passes, so a disabled call allocates nothing; the event then goes to the appenders up the hierarchy until additivity stops it.",
    },
    {
      prompt: "Which patterns fit the filters, asynchronous output and the logger registry? Should the registry be a Singleton?",
      hint: "Filters are consulted in order and any one of them may stop or approve the event. Async output needs the same interface as any appender plus one added concern. For the registry, think about tests and two applications sharing a process.",
      insight: "Filters are a Chain of Responsibility with ACCEPT, DENY and NEUTRAL; AsyncAppender is a Decorator around any Appender; Appender and Layout are Strategies; FilteringAppender is a Template Method that calls write. LoggerContext is an ordinary injected object, with a static default only for convenience, so tests and co-hosted applications get isolated configurations instead of one global tree.",
    },
    {
      prompt: "The asynchronous appender's queue is full. What happens to an INFO event, and to an ERROR event? How do you make the outcome visible?",
      hint: "Blocking protects the events but stalls the application; dropping protects the application but loses events. Must every severity get the same answer?",
      insight: "The queue is a bounded ArrayBlockingQueue: offer first; if it is full, INFO and below are dropped and counted, while WARN and ERROR block on put unless neverBlock is set. Counting drops turns silent loss into a known gap, and stop() drains the queue from a shutdown hook so queued events are not lost when the process exits.",
    },
    {
      prompt: "Name the shared mutable state and the tool for each: levels changed at runtime, appender lists, the logger registry, per-request context and the file itself.",
      hint: "Some state is written rarely and read on every call; some is iterated constantly but changed only at configuration time; one piece should not be shared at all; and one resource cannot take two writers at once.",
      insight: "Levels are volatile (one field, visibility only); appender lists are CopyOnWriteArrayList; the registry is a ConcurrentHashMap with the parent resolved outside computeIfAbsent, because the mapping function must not modify the map. Context is a ThreadLocal map copied into each event and removed in finally, since pooled threads are reused; a synchronous FileAppender needs a lock, which is exactly why the async design replaces that lock with a hand-off to one worker.",
    },
  ],
  tradeoffs: [
    "Level check before event creation vs building the event first: choose the check first because a disabled call then allocates nothing; expensive argument values need a lazy supplier.",
    "A bounded queue that sheds INFO vs blocking for every event: choose shedding cheap events because application threads then never wait on the disk, accepting counted INFO loss under overload.",
    "ArrayBlockingQueue vs a lock-free ring buffer: choose the queue for simplicity; switch to a Disruptor-style ring buffer when a profiler shows the queue's lock is where the time goes.",
    "Context as an injected object vs a Singleton: choose the object for isolated tests and several configurations per process, keeping a static default only for code that cannot be injected.",
  ],
  followUps: [
    "Add rolling log files. How would you split the responsibilities?",
    "A remote appender logs its own retries. What goes wrong, and how do you stop it?",
    "How do you keep the request id on log lines when work moves to another thread?",
    "A log collector wants JSON instead of text. What changes?",
  ],
};
