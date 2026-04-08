# For-Sale Auction + Realtime V1 Blueprint

This document captures the agreed v1 plan for building a Replicache + websocket auction experience in `orys`, aligned with `../../oss/replicache-cvr/REPLICACHE_SYNC_ENGINE.md`.

## Product model

- Any user can both buy and sell.
- There are no permanent account roles like "buyer" or "seller".
- Role is computed per listing:
  - `owner`: listing creator
  - `participant`: user with at least one bid on the listing
  - `viewer`: read-only

## Auction model

- V1 supports only `FOR_SALE` listings.
- Highest valid quote wins.
- Keep one quote path (no type/comparator branching).

## V1 scope

- Listing lifecycle: draft -> live -> ended -> awarded.
- Realtime listing cards on homepage.
- Realtime listing detail page (quotes, status changes).
- Live viewer count (for example: `89 viewing now`).
- Perceived-instant updates: optimistic local writes + websocket poke-triggered pulls.
- No payments for v1.

## Mutators (Replicache)

```ts
type AuctionMutators = {
  listingCreate: {
    listingId: string;
    title: string;
    description?: string;
    endsAtMs: number;
    minStepCents: number;
    currency: "USD";
  };

  listingPublish: {
    listingId: string;
  };

  quoteUpsert: {
    listingId: string;
    quoteId: string; // client-generated id for idempotency/history
    amountCents: number;
  };

  quoteWithdraw: {
    listingId: string;
    quoteId: string;
  };

  listingEndNow: {
    listingId: string;
  };

  listingAward: {
    listingId: string;
    quoteId: string;
  };
};
```

## Server-side mutation rules

- Derive acting user from authenticated session only (never trust `userId` in args).
- Enforce Replicache mutation ordering (`lastMutationId + 1`).
- Enforce listing-state constraints:
  - `quoteUpsert` only when listing is `LIVE` and not expired
  - `listingPublish` only from `DRAFT`
  - `listingAward` only from `ENDED`
- Enforce ownership constraints:
  - only owner can publish/end/award
  - no self-bidding on own listing
- Enforce improvement constraint:
  - amount must be higher than current best by at least `minStepCents`
- Keep one active quote per user per listing (upsert semantics).
- Advance mutation cursor even for handled business-rule errors so client queue does not stall.

## Realtime data shape (Replicache docs)

- `card/<listingId>`
  - `title`, `status`, `bestAmountCents`, `quoteCount`, `endsAt`, `lastActivityAt`
- `feed/home/<sortKey>/<listingId>`
  - lightweight index entries for homepage ordering/filtering
- `listing/<listingId>`
  - full listing detail used on listing page
- `leaderboard/<listingId>/<rank>`
  - public-safe ranking rows
- `my-quote/<listingId>`
  - participant private quote doc
- `private-quote/<listingId>/<quoteId>`
  - owner-only quote detail with participant identity
- `notification/<notificationId>`
  - private user notifications

## Pull shape by per-listing role

- Owner pull:
  - `listing/*`
  - `private-quote/*`
  - `leaderboard/*`
  - `notification/*`
- Participant pull:
  - `listing/*`
  - `leaderboard/*` (anonymized)
  - `my-quote/*`
  - `notification/*`
- Viewer pull:
  - `listing/*`
  - `leaderboard/*` (public-safe only)

If access scope changes, issue a one-time `clear` patch for that client group before rehydration.

## Sync engine baseline (Replicache CVR)

Use the same mental model and guarantees described in `../../oss/replicache-cvr/REPLICACHE_SYNC_ENGINE.md`:

- Push = mutation ingestion + monotonic mutation-id acknowledgement.
- Pull = CVR diff (`clear` / `del` / `put`) + `lastMutationIDChanges` + next cookie.
- Poke = "something changed, pull now" signal for near-real-time convergence.

Implementation expectations:

- Track `rowVersion` on replicated auction rows used in pull patches.
- Track per-client `lastMutationId` and per-client-group `cvrVersion`.
- Cache CVR snapshots by `<clientGroupID>/<order>` (Redis in production; memory acceptable for local demo).
- On handled business-rule errors, still advance mutation cursor (queue never stalls).
- Emit poke notifications after push handling so all active tabs/devices pull quickly.

## Realtime transport strategy

Use both Replicache and websocket channels:

- Replicache: authoritative state sync + optimistic UX.
- Websocket poke: immediate pull trigger.
- Websocket presence: ephemeral viewer counts.

### Channels

- `poke:listing:<listingId>`
- `poke:feed:home`
- `poke:user:<userId>`
- `presence:listing:<listingId>`

### Poke flow

1. Mutation committed on server.
2. Update row versions and persistence.
3. Publish poke to listing/home/user channels as needed.
4. Clients call `rep.pull()` on poke.
5. Keep periodic fallback pull (for example every 20-30s) during socket issues.

## "89 viewing now" presence model

Presence should not be part of Replicache pull patches.

- On listing page open, client joins `presence:listing:<listingId>`.
- Client sends heartbeat every 15s.
- Server tracks active viewers with expiry (for example 45s TTL).
- Server emits viewer count every 2-3s or on join/leave bursts.
- UI renders `NN viewing now` from latest presence payload.

For demo speed, in-memory presence is acceptable for single-node local runs. Move to Redis-backed presence for multi-node production.

## Demo plan (no real users)

Use 3 script groups:

- `demo:seed`
  - create users, create listings, publish listings
- `demo:bids`
  - synthetic bid activity by bot users with jitter
- `demo:viewers`
  - synthetic presence to maintain target counts (for example 89 viewing)

Suggested flow:

1. Start with one active listing page open on multiple tabs.
2. Run bid bots to show rapid cross-client convergence.
3. Run viewer bots to show live count increasing.
4. Disconnect one tab, continue activity elsewhere, reconnect and show catch-up.
5. End and award listing; verify all tabs converge to final state.

## Weekend implementation plan

### Day 1 AM

- Add auction + replicache schema in `packages/db/src/schema`.
- Generate and apply migration.
- Implement core mutation handlers and validation rules.

### Day 1 PM

- Implement Replicache push/pull endpoints in `packages/api`.
- Add row-version + CVR diff logic.
- Add websocket poke channels in `apps/server`.

### Day 2 AM

- Build listing detail realtime UI in `apps/web`.
- Build homepage card realtime feed using `card/*` and `feed/home/*` docs.

### Day 2 PM

- Implement presence channel and `viewing now` UI.
- Add demo scripts (`seed`, `bids`, `viewers`, optional `orchestrate`).
- Add lightweight developer status panel (`connected`, `last pull`, `pending mutations`).

## External 3rd party API reconciliation

### Core rule: mutations are DB-only

Mutations must never call external APIs directly. External work happens **after** the mutation commits, asynchronously, and reconciles back through the normal Replicache sync loop.

```
Mutations = synchronous, fast, predictable (DB only)
External effects = async, unreliable, eventual (webhook/poll/queue)
Reconciliation = external result writes to DB → new rowVersion → poke → client pulls
```

### The pattern

```ts
// ❌ Don't: block the mutation with an external call
async function listingAward(args) {
  const listing = await db.listing.update(args);
  await stripe.createCheckoutSession(listing); // slow, can fail, breaks ordering
  return listing;
}

// ✅ Do: commit state, queue external work
async function listingAward(args) {
  // 1. Commit authoritative state (mutation succeeds)
  const listing = await db.listing.update({ ...args, status: "AWARDED" });

  // 2. Queue external work (fire-and-forget or job queue)
  await jobQueue.enqueue("stripe:createCheckout", { listingId: listing.id });

  // 3. Return listing so client sees AWARDED immediately
  return listing;
}
```

### Reconciliation patterns

| Pattern                             | When to use                    | Example                                                          |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| **Webhook → DB → Poke**             | External system calls you back | Stripe webhook updates `paymentStatus: PAID`, poke triggers pull |
| **Poll → DB → Poke**                | You call external system       | Poll carrier API every 60s, update `trackingStatus`, poke        |
| **Mutation → Status doc → Observe** | Long-running ops               | `paymentStatus: PENDING` → client observes → flips to `PAID`     |

### How to track in-flight external work

Add explicit status fields to the replicated entity:

```ts
// In your listing doc (what clients see via pull)
{
  id: "abc",
  status: "AWARVED",
  paymentStatus: "PENDING",        // external async state
  paymentExternalId: "pi_123",
  paymentUpdatedAt: null
}
```

Client sees `PENDING` immediately after mutation. External webhook/poll updates to `PAID`. Poke triggers pull. Client sees final state.

### Concrete example: Stripe payments in auction

```
1. listingAward mutation commits     → listing.status = "AWARDED"
2. Server enqueues job               → "create payment intent"
3. Stripe webhook fires              → /api/webhook/stripe
4. Server updates listing            → paymentStatus = "PAID"
5. Server pokes                      → poke:listing:<id> + poke:user:<buyerId>
6. Clients pull                      → see updated paymentStatus
```

The client never calls Stripe directly. The mutation only moves local state. The external result arrives through the normal sync loop.

### Where to put this in orys

| Concern                        | Location                            |
| ------------------------------ | ----------------------------------- |
| Job queue (in-memory for demo) | `packages/api` or `apps/server`     |
| Webhook endpoints              | `packages/api`                      |
| External status fields         | `packages/db/src/schema/auction.ts` |
| External job runners           | `apps/server` or dedicated worker   |

### Important properties

- **Idempotency**: external job handlers must be idempotent (e.g. "set paymentStatus = PAID" is safe to replay).
- **Never block the mutation**: external work is best-effort; if it fails, the mutation is still valid.
- **Replay from DB**: if an external webhook arrives late, DB state is the source of truth; just overwrite with the external truth.
- **Poke on reconciliation**: always emit a poke after reconciling external state so clients update without waiting for periodic pull.

### Examples in auction v1

- **Stripe checkout**: mutation sets `paymentStatus: PENDING`, webhook sets `PAID/FAILED`.
- **Email notifications**: mutation commits, job queue sends email, optional `emailSentAt` field updated.
- **AI listing description**: mutation commits, job queue calls AI, result stored in `listing.aiDescription`, poke on completion.

## Notes for implementation

- Keep all authorization and business invariants on server.
- Treat client mutators as optimistic intent only.
- Minimize payloads for homepage cards to keep pulls fast.
- Ensure home-feed poke and listing poke are both emitted where applicable.
- External work is always asynchronous and reconciled through DB + pull, never inline in a mutation.
