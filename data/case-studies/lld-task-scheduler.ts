import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-task-scheduler",
  title: "Design a task scheduler",
  track: "lld",
  level: "advanced",
  minutes: 45,
  scenario: "Design an in-process scheduler for about 10,000 jobs on 16 worker threads. It runs a task once at an instant or after a delay, or repeatedly at a fixed rate, with a fixed delay or on a cron expression; failed runs retry with exponential backoff, every run has a timeout, jobs can be cancelled even mid-run, and shutdown is graceful. A job must never run concurrently with itself, and one misbehaving task must not delay every other job.",
  focus: "Separating what runs, when it runs next and the machinery that runs it, so a job is out of the queue while it runs and its next run is computed only after it finishes, which settles overlap, pile-up and retries with one mechanism.",
  concepts: ["design-patterns-behavioural", "concurrency-basics", "timeouts-retries", "idempotency", "testing-extensibility"],
  steps: [
    {
      prompt: "'Scheduler' can mean anything from a Timer replacement to a workflow engine. What do you include, and which non-functional promises matter most?",
      hint: "List the timing rules callers ask for, what should happen when a run fails or hangs, and how the scheduler stops. Then name the feature that would turn this into a different product.",
      insight: "One-shot, fixed rate, fixed delay and cron; retries with capped exponential backoff and a timeout per run; cancellation; graceful shutdown. Dependencies between tasks, a user interface and several machines are out; the promises that matter are no self-overlap, a prompt start when a worker is free, logarithmic dispatch cost and isolation from one bad task, with an injected Clock so tests never sleep.",
    },
    {
      prompt: "Which objects separate the work, the timing rule and the per-job runtime state, and which of them are mutable?",
      hint: "One of them should be a pure function you can test with two instants and share across a thousand jobs. Another must carry a status, a next run time and an attempt count.",
      insight: "Task is a Command with run(ctx) and must be safe to run twice; Schedule is a Strategy and an immutable value (OneShot, FixedRate, FixedDelay, CronSchedule); ScheduledJob binds a task, a schedule and a RetryPolicy and is the one mutable thing per job, carrying its state, next run and attempts. Scheduler is the facade, Dispatcher the loop, and JobHandle what the caller keeps.",
    },
    {
      prompt: "What inputs must Schedule.nextRun take so that both fixed rate and fixed delay can be expressed? What happens to each when a run overruns its period?",
      hint: "One rule measures from when the run was due, the other from when it finished. Work both out for a 10-minute period and a run that takes 13 minutes.",
      insight: "The schedule takes both instants, as nextRun(dueAt, finishedAt), because fixed rate returns dueAt plus the period while fixed delay returns finishedAt plus the delay. After an overrun, fixed rate's next run is already in the past, so late runs follow back to back until it catches up, while fixed delay's is always in the future, so nothing piles up; use fixed rate when every run is work that must happen, fixed delay when a run only refreshes the present.",
    },
    {
      prompt: "How does the scheduler wait for the next due job without polling, and how do you stop a full worker pool from piling up tasks or making the dispatcher run them itself?",
      hint: "There is a JDK queue that blocks until the head element's delay has expired. For the pool, think of a permit taken before a job is taken, and what CallerRunsPolicy would do to the dispatcher.",
      insight: "A DelayQueue of ScheduledJobs ordered by next run: one dispatcher thread acquires a Semaphore permit, then take() blocks until the earliest job is due, and the job goes to a bounded pool. With one dispatcher two can never take the same job, and waiting on a permit keeps the dispatcher free, whereas CallerRunsPolicy would make it run a 20-minute task and dispatch nothing meanwhile.",
    },
    {
      prompt: "Show why a job can never run twice at the same time, and how cancel() works both for a job that is waiting and for one that is running.",
      hint: "Where is the job while it runs? Then treat every state change as a conditional move from an expected state, and ask which move a requeue after a cancelled run would attempt.",
      insight: "The job is out of the queue while it runs and its next run time is written only while it is outside the queue, so it cannot be taken twice and the heap is never corrupted. Every transition is a compareAndSet on the job's state: cancel moves Scheduled to Cancelled and removes it, or Running to Cancelled and interrupts the running Future, after which the requeue's Running to Scheduled fails and the job is never offered again.",
    },
    {
      prompt: "One task throws, another hangs for ever, and the process dies after a third ran but before its state was saved. How does the design handle each?",
      hint: "Separate failures worth retrying from those that are not, and cap the attempts. Interruption in Java is cooperative. And a crash between the work and the bookkeeping means the work may happen again.",
      insight: "The worker catches the exception and asks the RetryPolicy: capped exponential backoff with jitter, giving up after a maximum or on a NonRetryable failure, so a retry is simply a reschedule. A hang is bounded by a deadline in the TaskContext plus a watchdog one-shot that cancels the running Future, since interruption only stops code that checks for it; a crash means the task may run again, so tasks must be idempotent, such as a report keyed by its period or a webhook with a delivery id.",
    },
  ],
  tradeoffs: [
    "Fixed rate vs fixed delay: choose fixed rate when every run must happen and may catch up in a burst; choose fixed delay when a run refreshes state and must not pile up.",
    "One dispatcher thread vs several: choose one because no two dispatchers can race for a job and reasoning stays easy; serial dispatch is fine at thousands of jobs a second.",
    "A Semaphore of worker permits vs the executor's rejection policy: choose permits because they give back-pressure without a hand-off queue and never make the dispatcher run a task, accepting that a full pool delays even a due job.",
    "Building this vs wrapping ScheduledThreadPoolExecutor: choose the JDK class for plain 'run this later'; choose this design when a job must survive a failure, a hang or a restart, because a periodic JDK task that throws is silently suppressed.",
  ],
  followUps: [
    "After a restart, a fixed-rate job has missed 400 runs. What does your misfire policy do for one-shot, fixed-rate and cron jobs?",
    "Run the scheduler on several machines. Which piece changes, and which patterns from the distributed lessons apply?",
    "Two jobs are due at the same instant. Which runs first, and how would you make the order deterministic?",
    "Add persistence so a restart can continue. When exactly do you write to the job store?",
  ],
};
