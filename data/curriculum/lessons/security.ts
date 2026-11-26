import type { LessonMeta } from "@/types/curriculum";

/** Module 11: Security. Bodies: content/lessons/<slug>.mdx; teaching guidance: data/lesson-guides/security.ts. */
export const lessons: LessonMeta[] = [
  {
    slug: "security-fundamentals", title: "Security fundamentals for system design", moduleId: "security", level: "basic", minutes: 11,
    problem: "Every box and arrow you draw is somewhere an attacker can read, change or deny access to data, and most designs never say where that is checked.",
    summary: "Security means confidentiality, integrity and availability for the right people and nobody else. You get there by marking trust boundaries, shrinking the attack surface, layering independent defences and giving every service and person the least privilege that still works.",
    catTip: "I nap on the server rack because the door was open, the badge reader was broken and the rack key was taped to the rack. Three layers, three failures. One working layer and I would be napping in the lobby.",
    recall: { q: "You add a webhook receiver to the post service. Which three security words describe what must happen when a call crosses that new trust boundary?", a: "Authenticate the sender (verify the webhook signature), authorise the action (may this sender change this object) and account for it (log who did what). The endpoint also widens the attack surface, so it should be the only new public path and run with least privilege." },
    archNodes: [],
  },
  {
    slug: "authentication", title: "Authentication: sessions, tokens and passwords", moduleId: "security", level: "intermediate", minutes: 14,
    problem: "Passwords get stolen in bulk, sessions get hijacked, and a login that lives in one server's memory breaks the moment you add a second server.",
    summary: "Authentication proves who is asking: salted adaptive hashes for passwords, an opaque session id in a hardened cookie or a signed bearer token for every request after login, a second factor that resists phishing, and single sign-on when an identity provider should own the login.",
    catTip: "My collar tag says Cache, but the vet still checks the microchip. Proof once, then a wristband for the visit. If I lose the wristband, anyone wearing it is me until it expires, which is exactly why it expires.",
    recall: { q: "Your login works on one server but users get logged out at random once you add a second one. What is wrong, and what are the two standard fixes?", a: "Sessions are stored in each server's own memory, so a request that lands on the other server finds nothing. Either keep sessions in a shared store such as Redis referenced by an opaque session id in a cookie, or issue a signed bearer token that any server verifies locally; either way the servers themselves stay stateless." },
    archNodes: ["gateway"],
  },
  {
    slug: "authorization", title: "Authorisation: RBAC, ABAC and policy", moduleId: "security", level: "intermediate", minutes: 12,
    problem: "Authentication tells you the request is from user 42; nothing yet says whether user 42 may read order 10024, and that gap tops the OWASP API Top 10.",
    summary: "Authorisation decides whether an authenticated caller may act on this object. Model permissions with roles, attributes or relationships, separate the decision point from the enforcement point, check coarse rules at the gateway and object-level rules in the service, and scope every query by tenant.",
    catTip: "The kitchen door knows I am Cache; that is authentication. The fridge still will not open for me; that is authorisation. The humans check it every single time, however hard I purr. Deny by default is a cruel, correct policy.",
    recall: { q: "A GET /orders endpoint checks the caller's token at the gateway and returns the requested order. A user changes the id and sees a stranger's order. Name the flaw and the fix.", a: "Broken object level authorisation (OWASP API1:2023): the endpoint was authorised, the object was not. The service must load the order and check, on every request, that the caller owns it or belongs to its tenant; the gateway cannot do this because it never loads the object." },
    archNodes: [],
  },
  {
    slug: "oauth-jwt", title: "OAuth 2.0, OpenID Connect and JWT", moduleId: "security", level: "intermediate", minutes: 16,
    problem: "Users want to log in with Google and let third-party apps touch their data, services need to call each other, and nobody should paste a password into someone else's app.",
    summary: "OAuth 2.0 issues short-lived access tokens through the authorization code flow with PKCE or client credentials; OpenID Connect adds a signed ID token saying who logged in; JWTs carry the claims, verified against the issuer's published keys and checked for issuer, audience and expiry.",
    catTip: "The vet gives the groomer a note: may wash Cache, may not vaccinate Cache, valid today only. The groomer checks the vet's signature, not my purring. Tomorrow the note is worthless, which is the whole point of the note.",
    recall: { q: "A resource server receives a JWT. List the checks it must perform before trusting the claims, in order.", a: "Fetch the key named by kid from the configured JWKS, verify the signature with an allow-listed algorithm, then check that iss is the expected issuer, aud includes this service, and exp and nbf are valid allowing small skew. Only then read sub and scope; the alg header is never trusted on its own." },
    archNodes: [],
  },
  {
    slug: "encryption", title: "Encryption in transit and at rest", moduleId: "security", level: "intermediate", minutes: 12,
    problem: "A stolen disk, a leaked database password and a curious administrator are three different attackers, and one tick-box called encrypted at rest defends against only the first.",
    summary: "Certificates bind keys to names, mutual TLS gives services identities, and encryption at rest comes in layers that stop different attackers. Envelope encryption keeps the master key in a KMS and wraps per-object data keys, so rotation and deletion become key operations.",
    catTip: "My treats are in a tin, the tin key is in an envelope, and the envelope only opens in the vault. The humans call this envelope encryption. I call it three layers between me and dinner, and all three work.",
    recall: { q: "You are asked to encrypt the users table at rest. What question do you ask first, and how do the answers change the design?", a: "Which attacker: a stolen disk or backup is covered by volume encryption or TDE, while a leaked database credential or an insider needs application-level field encryption with keys the database cannot reach. For the latter, use envelope encryption: per-record data keys wrapped by a KEK held in a KMS, stored alongside the ciphertext." },
    archNodes: [],
  },
  {
    slug: "api-security", title: "API security", moduleId: "security", level: "intermediate", minutes: 14,
    problem: "An API is a public surface where any client can send any bytes, change any id, replay any request and point your server at any URL.",
    summary: "API security is a chain of checks from edge to database: allow-list validation, parameterised queries, SameSite cookies and CSRF tokens, CORS that permits only your origins, keys and scoped tokens, rate limits and idempotency keys, and HMAC-signed, timestamped webhooks.",
    catTip: "Every parcel through my cat flap gets the same treatment: is it addressed to me, is it the right shape, have I seen this one before, and did the courier sign for it today? Only then do I sniff it.",
    recall: { q: "Your webhook receiver checks the HMAC signature but ignores the timestamp in the header. What attack remains, and what two things close it?", a: "Replay: a captured, validly signed request can be resent later. Include the timestamp in the signed string and reject requests outside a tolerance window (Stripe's default is five minutes), and deduplicate by event id for replays inside the window." },
    archNodes: ["gateway"],
  },
  {
    slug: "secrets-management", title: "Secrets management", moduleId: "security", level: "intermediate", minutes: 11,
    problem: "Database passwords and API keys end up in git, images, environment files and logs, and once copied there they outlive every rotation nobody remembered to do.",
    summary: "Secrets belong in a secrets manager that encrypts, access-controls and audits them, issues dynamic short-lived credentials on demand and rotates the static ones; workloads authenticate to it with a platform-issued identity instead of a stored key, so there is no secret zero.",
    catTip: "The humans used to tape the treat-cupboard key under the mat. Now the cupboard issues a card that works for one hour and writes down who used it. I am told this is progress. I am still working on getting a card.",
    recall: { q: "A service needs a database password. Describe the design in which no engineer ever sees it and a stolen copy is useless within an hour.", a: "The service authenticates to a secrets manager such as Vault with its workload identity (a cloud role, Kubernetes service account or SPIFFE identity), and the manager creates a unique database user with a one-hour lease on demand. The credential is held only in memory, renewed or replaced before expiry and revoked when the lease ends; the audit log names the instance." },
    archNodes: [],
  },
  {
    slug: "threat-modelling", title: "Threat modelling and security boundaries", moduleId: "security", level: "advanced", minutes: 14,
    problem: "Security reviews that start from a checklist miss the attacks that matter for this system, and reviews that start from fear never finish.",
    summary: "Threat modelling draws the system as a data-flow diagram with trust boundaries, applies STRIDE and abuse cases at each one, and answers with layers: zero-trust identity and authorisation inside the network, segmentation to cut blast radius, and DDoS absorbed at the edge first.",
    catTip: "I threat-model the house daily: front door, cat flap, the window the humans forget. For each I ask who could get in, what they could take, and whether anyone would notice. Then I nap in the safest spot.",
    recall: { q: "Apply STRIDE to the boundary between your services and the database when every service connects with the same password. Name two threats and their fixes.", a: "Spoofing: anyone holding the password is any service, fixed by per-workload identities (mTLS or dynamic credentials). Repudiation: the audit log shows one user for everything, fixed by per-service credentials. A third is elevation of privilege through injection into an over-privileged account, fixed by least-privilege grants and parameterised queries." },
    archNodes: [],
  },
];
