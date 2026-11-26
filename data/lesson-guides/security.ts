import type { LessonGuide } from "@/types/curriculum";

/** Teaching guidance for Module 11: Security, by lesson slug. */
export const guides: Record<string, LessonGuide> = {
  // Security
  "security-fundamentals": {
    breaks: "Without explicit boundaries and layers, one leaked password or one unchecked endpoint hands an attacker everything, because the design only ever assumed the front door would hold.",
    tradeoffs: "Every layer costs latency, operational work and friction for legitimate users, so you choose where the boundaries are and how many layers each one deserves instead of defending everything equally.",
    explainSimply: "A secure system lets the right people see and change their data and keeps everyone else out, even when part of it is under attack. Think of a bank branch: a lock, a guard, cameras and a vault, each built assuming the one before it has failed. You decide where the doors are and give every key the fewest rooms it needs.",
    hint: "Think of the three A words, and what a new public endpoint does to the attack surface.",
  },
  "authentication": {
    breaks: "Fast unsalted hashes let a stolen table be cracked in hours, a cookie without flags is stolen by one script bug, and a login kept in one server's memory vanishes when the load balancer picks another server.",
    tradeoffs: "Every strengthening costs something: slow hashes burn CPU on each login, server-side sessions need a highly available store, self-contained tokens are hard to revoke, and extra factors add friction and account-recovery problems.",
    explainSimply: "Logging in is like checking in at a hotel: you prove who you are once and get a key card that opens your room until checkout. The card is just a random number the front desk can look up, so losing it is bad but the desk can cancel it instantly. A second factor is the desk also ringing your phone before handing it over.",
    hint: "Where does the session live right now, and where could it live so that any server can find it?",
  },
  "authorization": {
    breaks: "Without per-object checks any authenticated user reads or changes other users' data by editing an id, and without a tenant predicate on every query one customer's bug or malice reads another customer's rows.",
    tradeoffs: "A central policy engine gives one auditable ruleset but becomes a latency and availability dependency, while permissions cached inside tokens are fast but stale until the token expires.",
    explainSimply: "Knowing who someone is does not tell you what they may touch. A badge gets you into the building and onto your floor, but the filing cabinet has its own lock, and whether your key fits depends on what is inside. Software has to check that cabinet lock on every single request.",
    hint: "Ask what was checked (the route) and what was not (the row), and which component could have known.",
  },
  "oauth-jwt": {
    breaks: "Without a standard flow apps collect passwords, codes get intercepted by rogue apps on the same phone, and tokens get accepted by services they were never meant for, or with no signature at all.",
    tradeoffs: "Self-contained tokens are verified locally but cannot be recalled before they expire, so you trade revocation latency for request latency and lean on short lifetimes plus revocable refresh tokens.",
    explainSimply: "Instead of giving a valet your whole key ring, you hand over a valet key that starts the car but will not open the boot, and it stops working at midnight. The dealer who cuts those keys also writes a signed note saying who you are. Anyone who receives such a key checks the signature and the date before trusting it.",
    hint: "Who signed it, for whom, until when, and did you decide the algorithm or did the token?",
  },
  "encryption": {
    breaks: "Encrypting only the disk leaves anyone with a database password reading plaintext, keys kept next to the data protect nothing, and a key nobody backed up turns a routine restore into permanent data loss.",
    tradeoffs: "Each layer costs CPU, a KMS round trip or the ability to index and search the field, and every key you create is something that can be lost, so you encrypt by named attacker rather than everywhere by default.",
    explainSimply: "Locking the warehouse door stops thieves outside; it does not stop someone with a staff badge from reading the files. So you also lock the sensitive drawers, keep those drawer keys in sealed envelopes, and only the vault can open the envelopes. Burn an envelope and that drawer is gone for good, even from the copies.",
    hint: "Name the attacker, then name the layer that stops that attacker and where its key lives.",
  },
  "api-security": {
    breaks: "Without these checks a changed id returns another user's data, a quote in a form field rewrites your SQL, a hostile web page makes a logged-in browser change settings, and a captured webhook is replayed until someone notices.",
    tradeoffs: "Every check adds latency and rejected edge cases, strict validation breaks old clients, tight limits frustrate heavy legitimate users, and signatures and idempotency stores are more state to run.",
    explainSimply: "Think of a post room that checks every parcel: is the address real, is it the right shape and weight, has the same parcel arrived before, and did the courier sign the delivery slip with today's date? None of the checks is clever; the protection comes from doing all of them to every parcel.",
    hint: "Which part of the request proves when it was sent, and what happens if that part is missing?",
  },
  "secrets-management": {
    breaks: "A secret pasted into git, an image or an env file is readable by everyone who can read those, lives forever in forks and caches, and cannot be traced to whoever used it.",
    tradeoffs: "The secrets manager becomes a tier-one dependency at startup, dynamic credentials add database users and connection churn, and rotation needs dual-version rollouts that take engineering time.",
    explainSimply: "Instead of hiding the cupboard key under the mat where everyone knows to look, a desk issues each helper a card that opens only their cupboard for one hour and writes down who used it. Lose a card and little is lost. Nobody ever holds the master key.",
    hint: "Who hands the credential out, how long does it live, and how did the service prove who it was in order to ask?",
  },
  "threat-modelling": {
    breaks: "Without a model you defend the parts you happen to know about, trust the private network because it is private, and discover the abuse case when the ticket bots or the scrapers do.",
    tradeoffs: "Modelling takes time from building and goes stale as the architecture changes, zero trust adds identity and policy machinery to every internal call, and edge DDoS protection is a cost paid before any attack happens.",
    explainSimply: "Threat modelling is walking round the house with a burglar's eyes: list every door and window, and at each one ask who could pretend to be the postman, swap the parcel, sneak a look in, block the door or reach the safe. Then fix the worst ones first, and walk again after every renovation.",
    hint: "Who could pretend to be a service, and who would the log blame?",
  },
};
