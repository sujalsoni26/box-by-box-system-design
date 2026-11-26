import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 3: Communication, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Communication: many services
  rest: {
    breaks: "Without an agreed contract, the iOS app, the Android app and the website each call the server in their own way, and every server change quietly breaks one of them.",
    tradeoffs: "JSON text is verbose, and fixed endpoints rarely match one screen exactly, so clients either receive data they don't use or make extra calls.",
    explainSimply: "REST gives everything in your app an address, like /users/42 or /posts/7. You act on those addresses with a few standard verbs: GET to read, POST to create, PATCH to edit, DELETE to remove. It's like a library where every book has a shelf code and the desk accepts only a few kinds of request.",
    hint: "Picture a profile screen that needs a name, a photo and three recent posts, and compare what one endpoint returns with what the screen actually uses.",
  },
  grpc: {
    breaks: "With services calling each other thousands of times a second in verbose JSON, CPU and bandwidth go into encoding and parsing text, and a renamed field breaks a caller only when the call fails at runtime.",
    tradeoffs: "Every service couples to the shared .proto schema, so changes must stay backward compatible (never reuse or renumber a field), and the binary messages need tooling to read.",
    explainSimply: "gRPC lets one service call a function in another service as if it were in the same program. Both sides agree on a strict form in advance, so messages travel as compact numbered fields instead of wordy text. It's like two clerks using a pre-printed form with numbered boxes instead of writing letters.",
    hint: "Think about who reads and sends these messages: a backend service with generated code, or a person debugging in a browser?",
  },
  websockets: {
    breaks: "Without a push channel, a chat message sits unseen until the recipient's app asks again, and millions of phones asking every few seconds flood the servers with mostly empty answers.",
    tradeoffs: "Connections are long-lived and stateful, so each server holds thousands of them, clients must reconnect after every drop, and routing a message gets harder.",
    explainSimply: "Normally the app must ask the server for news, so a chat app would keep asking whether anything is new. A WebSocket keeps one line open in both directions, like a walkie-talkie channel. The server can speak the moment a message arrives.",
    hint: "Think about where each user's open connection lives, and what a message from Asha needs to know to reach Ben.",
  },
  microservices: {
    breaks: "With dozens of engineers in one codebase, every release waits on everyone else's changes, and one bad deploy in the comments code takes down login, feed and uploads together.",
    tradeoffs: "You pay with a distributed system: calls cross the network, split data makes cross-service consistency hard, and monitoring, tracing and deployments add heavy operational overhead.",
    explainSimply: "A monolith is one big kitchen where every cook shares one stove and one menu. Microservices are a food court: separate stalls, each with its own cook, menu and storeroom. Stalls can change or close on their own, but customers now need a way in and a way to find the right stall.",
    hint: "Think about what clients and services lose once there is no longer one address to call.",
  },
  "sync-async": {
    breaks: "If posting a photo waits for resizing, follower notifications and analytics before replying, the user stares at a spinner, and an outage in notifications makes uploads fail too.",
    tradeoffs: "Async work gives no immediate result, leaves the system eventually consistent and harder to trace, and needs a queue to carry the messages.",
    explainSimply: "Synchronous is waiting at the counter until your coffee is made. Asynchronous is ordering, taking a token and sitting down; the coffee arrives when it's ready. Wait only when you truly need the answer right now.",
    hint: "For each step, ask whether the user needs its result before the app can say the post is up.",
  },
};
