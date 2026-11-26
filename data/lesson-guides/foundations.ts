import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 1: Foundations, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Foundations: 1 user, 1 server
  "big-idea": {
    breaks: "Draw boxes without a reason and you build a cache, a queue and shards on day one, pay for complexity you don't need, and can't defend any of it when asked why.",
    tradeoffs: "It takes patience: you start with one server and one database and add a box only after you can name the problem that forces it in, usually the database.",
    explainSimply: "Think of moving into an empty flat. You buy a bed first, a table when you need somewhere to eat, and shelves when the books pile up. A good system grows the same way: each new piece answers a problem you can point to.",
    hint: "Every box in this course appears at the moment something breaks; turn that into the question you ask about each one.",
  },
  "client-server": {
    breaks: "Without a shared server, each phone sees only the photos stored on it, and there is no single place to check passwords, store posts or enforce the rules.",
    tradeoffs: "Many clients share one server, so a thousand phones asking at once means a thousand units of work in one place, and every later scaling problem starts there.",
    explainSimply: "The client is the app on your phone; the server is a computer you run somewhere else. The app asks for something, like your feed, and the server looks it up and sends it back. It works like a shop counter: customers ask, the shopkeeper fetches, and the shopkeeper never calls a customer first.",
    hint: "Think about which side waits quietly until it is asked something.",
  },
  dns: {
    breaks: "Without DNS, users would have to type 203.0.113.10 instead of instagram.com, and every move to a new server would mean telling every user a new number.",
    tradeoffs: "Caching at every step makes lookups near-instant, but a changed IP spreads slowly until old TTLs expire, so teams lower the TTL days before a migration.",
    explainSimply: "People remember names; computers find each other by numbers. DNS turns a name like instagram.com into the server's number, like a directory you call to get a shop's phone number. You note the number down for a while, so the next visit skips the directory.",
    hint: "Every step of a lookup remembers the answer for a while; ask what that memory does when the record changes.",
  },
  "tcp-udp": {
    breaks: "On the raw network a photo upload can arrive with chunks missing or out of order, and the server saves a corrupted image unless something checks, resends and reorders the packets.",
    tradeoffs: "TCP's reliability costs extra round trips, a handshake before any data and waits for resends, which is why live video and games choose UDP and accept lost packets.",
    explainSimply: "Data travels as small packets, and the network may lose or reorder them. TCP is like a careful phone call: the listener confirms each sentence and asks you to repeat anything missed. UDP is like live radio: fast, and a missed word is simply gone.",
    hint: "Ask what a video frame is worth if it shows up half a second late.",
  },
  http: {
    breaks: "Without a shared format, the server can't tell whether the app wants to read the feed or post a photo, and without TLS anyone on the café Wi-Fi can read the password the app sends.",
    tradeoffs: "Setting up TCP and TLS costs round trips before the first byte of data, which is why HTTP/2 reuses one connection and HTTP/3 folds the handshakes together.",
    explainSimply: "HTTP is a fixed layout for every message: what you want, which resource, some extra details, and a status code in the reply. HTTPS is like sending that message in a sealed, tamper-evident envelope to a recipient who must show ID first. Nobody in between can read it or change it without being noticed.",
    hint: "Picture the café Wi-Fi: list what an attacker there might try to do to your messages, and match one TLS guarantee to each.",
  },
  latency: {
    breaks: "Without knowing where time goes, you add app servers while the database is the real bottleneck, and a healthy-looking average hides the 1 in 100 users who wait seconds.",
    tradeoffs: "Running close to maximum throughput uses hardware efficiently, but queues form and latency shoots up, so you trade spare capacity for predictable response times.",
    explainSimply: "Latency is how long one trip takes; throughput is how many trips finish per hour. A supermarket line with one slow cashier moves at that cashier's pace, however many baggers you hire. The average wait also hides the few people stuck behind a problem order, so you watch the slowest 1% too.",
    hint: "You want the number of requests inside the system at any moment; think about which two numbers you already know that could give you that count.",
  },
};
