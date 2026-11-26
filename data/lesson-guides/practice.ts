import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 6: System Design Practice, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // System design practice
  "estimation-numbers": {
    breaks: "Skip the rough numbers and you can't tell whether the app needs one server or three hundred, so you shard where one database would do or miss the cache you really need.",
    tradeoffs: "Rounding hard keeps the maths quick enough to say out loud, at the cost of precision, so you state each figure as an assumption that real workloads can change.",
    explainSimply: "Estimation means sizing a system with round numbers before you design it. Like guessing how many chairs a party needs from the guest list, you don't need the exact count, just whether it's ten or a thousand. Rounding to powers of ten lets you do the maths in your head.",
    hint: "Work out 24 × 60 × 60, then ask which power of ten it is closest to.",
  },
  "estimation-formulas": {
    breaks: "Size for an average day and the system falls over in the first minutes of a flash sale or a contest, when traffic runs several times higher.",
    tradeoffs: "Every result rests on stated assumptions such as DAU, actions per user and object size, so one wrong guess flows into every number; saying them aloud lets the interviewer correct you early.",
    explainSimply: "A few simple formulas turn how many users you have into requests per second, disk space and server count. Each one is multiplication and division with round numbers. Like a shop that adds staff for festival weekends, you plan for the busiest hour, not the average.",
    hint: "Count the total actions in a day, spread them over the seconds in a day, then ask how much busier the busiest moments are.",
  },
  "estimation-examples": {
    breaks: "Without running the formulas on real systems, you treat a URL shortener and Google Drive alike because both see about 1k writes a second, and miss that one needs caches while the other needs object storage and a CDN.",
    tradeoffs: "Each example rests on assumed inputs, and small slips compound, such as counting 4 billion records over 10 years instead of 365 billion.",
    explainSimply: "Worked examples run the formulas on real systems so you can see which number is biggest. A link shortener stores tiny records that are read constantly, so fast reads matter most. A file drive gets about the same number of uploads, but each one is far bigger, so storage and bandwidth matter most.",
    hint: "Multiply the daily count by the days in 10 years, then find the smallest power of 62 that beats it.",
  },
  "system-shapes": {
    breaks: "Without spotting the dominant number, you might build a chat system around caches and read replicas when its real load is a nonstop stream of new writes.",
    tradeoffs: "Calling a system one shape is a simplification, so you confirm with the interviewer which number dominates before committing the design to it.",
    explainSimply: "Most systems fall into one of three types. Some serve tiny pieces of data that are read over and over, some store and move huge files, and some take in an endless flood of new writes. Knowing which type you have tells you which tools matter most.",
    hint: "Ask which number explodes for a chat app: reads of the same item, the size of each item, or the sheer count of new items.",
  },
  "final-architecture": {
    breaks: "Learn the blocks one at a time but never assemble them, and you can't explain how a request travels from DNS to the database or why each box sits where it does.",
    tradeoffs: "Every component adds complexity and cost, so each box in the final picture must be justified by the problem it solves.",
    explainSimply: "The final architecture is the whole app on one map. A request finds the front door through DNS, static files come from nearby copies, and API calls pass a gatekeeper to the services, which check a fast memory before the database. Each box sits exactly where its problem shows up.",
    hint: "Ask whether the user needs the resized photo before the app confirms the post, and where the finished files end up.",
  },
  "revision-map": {
    breaks: "If you only reread notes, you recognise every block on the page but freeze when an interviewer describes a problem and waits for you to name the fix.",
    tradeoffs: "Answering from memory is slower and less comfortable than rereading, and the cards you miss keep coming back until you know them.",
    explainSimply: "This is a deck of flash cards, each naming a problem. You say the building block that fixes it, then flip to check. Struggling to remember is what makes the answer stick.",
    hint: "Think of the switch in a house that trips before the wiring catches fire.",
  },
  playbook: {
    breaks: "Without a fixed order, you start drawing boxes at random, spend 20 minutes on requirements or none at all, and never reach the deep dives where most of the signal is.",
    tradeoffs: "It takes discipline and a clock: each early step stays short, about 5 minutes for requirements, to leave 10 to 15 minutes for deep dives.",
    explainSimply: "The playbook is a recipe for a design interview. You pin down what to build, size it, describe it, then dig into the hardest parts. Following the same order every time keeps you calm and covers what interviewers look for.",
    hint: "Think about what you must know before drawing anything, what you must specify next, and what you save for the end.",
  },
  "test-yourself": {
    breaks: "If you only reread lessons, the material feels familiar but won't come back under interview pressure, and you can't tell which topics you have actually forgotten.",
    tradeoffs: "Recall practice is slower and less comfortable than rereading, and wrong answers are part of the process, not a sign it isn't working.",
    explainSimply: "Testing yourself means answering from memory before you look. It's like practising a song without the lyric sheet: harder, but it shows which lines you really know. The cards you miss come back, so your practice goes where it's needed.",
    hint: "Imagine your login lives in one server's memory and the load balancer sends your next request somewhere else.",
  },
};
