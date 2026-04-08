# Orys Auction V1 PRD

## Product intent

Build a real-time FOR_SALE auction experience where actions feel instant locally and converge across tabs/devices almost immediately.

This version is explicitly modeled after the Replicache CVR sync pattern described in `../../oss/replicache-cvr/REPLICACHE_SYNC_ENGINE.md`.

## Problem statement

Current Orys is a scaffold with auth and database plumbing, but no collaborative real-time product surface. We need a concrete v1 experience that demonstrates:

- optimistic local interaction,
- authoritative server-side invariants,
- fast multi-client convergence,
- resilient recovery after disconnects.

## Goals

- Deliver a single-mode auction (`FOR_SALE`) with listing lifecycle and bidding.
- Make updates feel instant to the acting user and near-instant to other viewers.
- Use Replicache push/pull + CVR diff as the canonical sync mechanism.
- Use websocket channels for poke and presence only.

## Non-goals (v1)

- Reverse auctions (`WANTED`) or listing type branching.
- Payments, escrow, checkout, or invoicing.
- Search/recommendation systems.
- Native mobile clients.

## Users and role model

- Any authenticated user can create listings and place bids.
- No permanent account roles.
- Role is computed per listing:
  - `owner`: created the listing.
  - `participant`: has at least one bid on the listing.
  - `viewer`: read-only on that listing.

## Core user journeys

1. Owner creates listing in draft and publishes.
2. Participants place/upsert bids; leaderboard and cards update in real time.
3. Viewers watch listing detail and live viewer count.
4. Owner ends listing and awards winning bid.
5. Disconnected client reconnects and catches up via pull patch.

## Functional requirements

### FR-1 Listing lifecycle

- Listing states: `DRAFT`, `LIVE`, `ENDED`, `AWARDED`.
- Only owner can `publish`, `end now`, and `award`.
- `listingAward` allowed only from `ENDED`.

### FR-2 Bidding rules (FOR_SALE only)

- One active bid per user per listing (upsert semantics).
- Bid allowed only when listing is `LIVE` and not expired.
- No self-bidding by listing owner.
- Bid must be at least `currentBest + minStepCents`.

### FR-3 Mutator contract

Mutators:

- `listingCreate`
- `listingPublish`
- `quoteUpsert`
- `quoteWithdraw`
- `listingEndNow`
- `listingAward`

All mutators are optimistic client intent; server is authoritative.

### FR-4 Push semantics

- Authenticate from session/cookies; never trust user id in mutator args.
- Enforce strict per-client ordering: expected mutation id is `lastMutationId + 1`.
- Old mutation ids are idempotently ignored.
- Future mutation ids are rejected as gaps.
- Business-rule failures still advance mutation cursor and return structured errors.

### FR-5 Pull semantics (CVR diff)

- Pull response returns:
  - `cookie` (`clientGroupID`, `order`)
  - `lastMutationIDChanges`
  - `patch` (`clear`/`del`/`put`)
- First sync or CVR miss triggers full rebase (`clear + puts`).
- Incremental sync returns only changed/deleted docs by rowVersion diff.
- Access scope changes must trigger one-time `clear` before rehydration.

### FR-6 Realtime transport

- Websocket poke channels:
  - `poke:listing:<listingId>`
  - `poke:feed:home`
  - `poke:user:<userId>`
- On poke, client calls `rep.pull()` immediately.
- Client keeps fallback pull interval (20-30s) while websocket is degraded.

### FR-7 Presence model

- Presence is ephemeral and separate from Replicache patch state.
- Client joins `presence:listing:<listingId>` on page open.
- Heartbeat every 15s.
- Server TTL expiry around 45s.
- Server emits viewer count every 2-3s or on bursty joins/leaves.
- UI shows `NN viewing now` from latest presence payload.

### FR-8 Realtime UI surfaces

- Homepage card feed updates in real time.
- Listing detail updates bids/status in real time.
- Developer status panel shows connection and sync health.

## Data/keyspace requirements

Replicache document families:

- `card/<listingId>`
- `feed/home/<sortKey>/<listingId>`
- `listing/<listingId>`
- `leaderboard/<listingId>/<rank>`
- `my-quote/<listingId>`
- `private-quote/<listingId>/<quoteId>`
- `notification/<notificationId>`

Role-based pull visibility:

- Owner: listing + private quote + leaderboard + notifications
- Participant: listing + anonymized leaderboard + my quote + notifications
- Viewer: listing + public-safe leaderboard

## Non-functional requirements

- Local interaction feedback: immediate via optimistic update.
- Cross-client convergence target: sub-1s p95 under healthy websocket.
- Recovery target without websocket: within fallback pull interval.
- No data leak across role boundaries in pull patches.
- Mutation acknowledgement remains monotonic even on handled errors.

## API/runtime requirements

- Expose `POST /api/replicache/push` and `POST /api/replicache/pull`.
- Keep pull diff computation transactional and safe under concurrency.
- Use in-memory CVR/presence for local demo; allow Redis-backed adapters for production.

## Telemetry and observability

- Track per-client last pull time and pending mutation count.
- Log mutation failures with machine-readable error codes.
- Track websocket connection count and presence channel cardinality.

## Demo and acceptance criteria

Demo scripts:

- `demo:seed` to create users/listings and publish.
- `demo:bids` to generate bid traffic with jitter.
- `demo:viewers` to simulate presence and target viewer counts.

V1 is accepted when:

1. Two+ tabs show near-immediate bid convergence.
2. Owner-only actions are enforced and self-bid is blocked.
3. Failed bid still advances mutation id (no queue stall).
4. Reconnect after disconnect results in correct catch-up state.
5. End + award propagates consistently to all active clients.
