import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 4: Data, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Data: millions of rows
  "sql-nosql": {
    breaks: "Pick a store without asking how the data is read and written, and you end up fighting it: joins it can't do, lookups that won't scale, or money stored without the transactions it needs.",
    tradeoffs: "Relational stores give joins and ACID transactions but take work to spread across machines, while many NoSQL stores give up joins and rich queries in return for flexible shapes and easy scale-out.",
    explainSimply: "A relational database is like a set of spreadsheets with strict columns, where rows in one sheet can point to rows in another. NoSQL covers other storage styles: a giant dictionary, a folder of documents, wide tables spread over many machines, or a web of connections. You pick by how the data looks and how you need to find it.",
    hint: "Picture choosing a store for bank balances and for like counts, and list the questions that make those two choices different.",
  },
  acid: {
    breaks: "Without transactions, a crash halfway through a transfer leaves one account debited and the other untouched, and two withdrawals at the same moment can both spend the same balance.",
    tradeoffs: "The guarantees cost performance, stricter isolation levels are slower, and they get much harder to keep once data spans several machines.",
    explainSimply: "A transaction groups several changes so they all happen or none do. Think of a shop sale: the money goes into the till and the item leaves the shelf, or neither happens. ACID names four promises that keep this safe through crashes and many customers at once.",
    hint: "Think about where each C matters: one applies even with a single database, the other only once data is copied across machines.",
  },
  indexing: {
    breaks: "Without an index, logging in by email scans every row, so the query slows down as the table grows and a burst of logins can pin the database.",
    tradeoffs: "Each index takes extra storage and slows every insert, update and delete, because the index must change too.",
    explainSimply: "An index works like the index at the back of a textbook. Instead of reading every page to find a topic, you look it up in a sorted list and jump straight to the right page. The database keeps a similar sorted list for a column, so it checks a few entries instead of millions of rows.",
    hint: "Ask which column the sorted list is ordered by first, and what happens when a query skips that column.",
  },
  normalization: {
    breaks: "If every feed view joins users and counts likes for each post, the most visited page in the app gets slower as the tables grow.",
    tradeoffs: "Duplicated data reads fast but makes writes heavier and lets copies drift: when someone renames their account, many rows must change.",
    explainSimply: "Normalizing means writing each fact in one place, like keeping a friend's address only in your contacts. Denormalizing means copying it where you need it, like printing it on every envelope in advance. Copies save time when reading but must all be fixed when the address changes.",
    hint: "Think about which pages are read constantly, and what you should check before you start copying data.",
  },
  replication: {
    breaks: "With one database, a surge of feed reads slows every query, and when that machine dies the whole app is down and recent data may go with it.",
    tradeoffs: "Asynchronous replicas lag, so users can see stale data and recent writes can be lost in a failover, while every write still goes through one primary.",
    explainSimply: "Replication keeps copies of the same data on several machines. One machine, the primary, takes every change and passes it on to the others, which answer reads. It's like a teacher writing on the board while students copy it: you can read any student's notebook, but it may be a line behind.",
    hint: "Ask which copy served the refresh, whether it had caught up yet, and which copy is sure to have your comment.",
  },
  sharding: {
    breaks: "Once the data passes what one machine can hold, or writes outpace one primary, more replicas don't help: each one still stores everything and every write still lands on the same primary.",
    tradeoffs: "The shard key is hard to choose, hot keys overload one shard, cross-shard joins and transactions are slow and complex, and adding shards means moving data.",
    explainSimply: "Sharding splits one huge table into pieces and puts each piece on a different machine. It's like a library that keeps authors A to F in one building, G to M in another, and so on. Each building holds less, but you need a rule that says which building to visit.",
    hint: "Think about whether each extra machine holds all of the data or only part of it.",
  },
  consistency: {
    breaks: "Without a clear consistency promise, a user edits their bio, refreshes and sees the old one, and a payment check can read a balance that a deposit hasn't reached yet.",
    tradeoffs: "Strong consistency costs latency and availability because reads must see the latest write everywhere, while eventual consistency is fast but serves stale data for a while.",
    explainSimply: "When data has copies, they don't all change at the same instant. A consistency model is the promise about what you see right after a change: always the newest version, or perhaps an older one for a moment. It's like a price change in a chain of shops, where some branches show the new tag before others.",
    hint: "For each feature, ask what the worst outcome of a read that is a few seconds old would be.",
  },
  cap: {
    breaks: "If you never decide what happens when replicas can't talk, a network partition can let two ATMs pay out the same balance, or freeze a feed that could safely have shown slightly old posts.",
    tradeoffs: "During a partition you either refuse or delay requests to stay correct or answer with possibly stale data, and even when the network is healthy, stronger consistency costs cross-region round trips.",
    explainSimply: "Picture two branches of a shop sharing one stock count over the phone. If the line goes dead, each branch can stop selling until it's back, or keep selling and fix mistakes later. Even when the line works, checking with the other branch before every sale makes each sale slower.",
    hint: "Ask what has to exist before two copies can disagree or lose touch with each other.",
  },
  "object-storage": {
    breaks: "If photos and videos go into the database and through the app servers, the database bloats and the servers spend their bandwidth relaying huge uploads instead of answering API calls.",
    tradeoffs: "You can't edit an object in place or query inside it, and reads are slower than a local disk, so a CDN usually sits in front.",
    explainSimply: "Object storage is a huge, cheap warehouse for files such as photos and videos. Each file gets a label, its key, and the database keeps only that label, not the file. The app can hand a user a short-lived pass to put one file straight into the warehouse.",
    hint: "Think about which machines would have to carry a 20 MB video if the phone sent it to your API first.",
  },
};
