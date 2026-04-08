# Orys Auction V1 Implementation Plan

Ship a FOR_SALE-only auction experience with Replicache CVR sync and websocket poke/presence so the UI feels instant.

## Delivery constraints

- Single auction mode only (`FOR_SALE`).
- Replicache is the source of truth for synced state.
- Websocket is a fast signal path (poke + presence), not a source of durable state.
- Mutation cursor must advance even when business rules reject a mutation.

## Ordered workstreams

1. Dependency and env foundation
   - **Files**: `package.json`, `apps/web/package.json`, `apps/server/package.json`, `packages/env/src/server.ts`, `packages/env/src/client.ts`, `apps/server/.env.example`, `apps/web/.env.example`, `.env.example`
   - **What**:
     - Add Replicache client dependency in web app.
     - Add optional cache/pubsub env vars for production (`REDIS_URL`) while keeping local in-memory fallback.
     - Add optional client websocket override (`NEXT_PUBLIC_WS_URL`) or derive from `NEXT_PUBLIC_SERVER_URL`.
   - **Done when**:
     - `bun install` completes with new dependencies.
     - Env validation supports local dev defaults and optional production cache transport.

2. Auction + sync schema in Postgres
   - **Files**: `packages/db/src/schema/auction.ts`, `packages/db/src/schema/replicache.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/migrations/*`
   - **What**:
     - Create auction tables (`listing`, `quote`) with row-version columns and indexes for feed/detail queries.
     - Create sync tables (`replicache_client_group`, `replicache_client`) for mutation ordering and CVR versioning.
     - Model listing state machine: `DRAFT -> LIVE -> ENDED -> AWARDED`.
     - Keep listing type out of schema (no `WANTED` branch).
   - **Done when**:
     - `bun run db:generate` creates migration.
     - `bun run db:migrate` applies cleanly.

3. Push pipeline with strict mutation semantics
   - **Files**: `packages/api/src/replicache/push.ts`, `packages/api/src/replicache/mutators.ts`, `packages/api/src/replicache/validation.ts`, `packages/api/src/auction/service.ts`
   - **What**:
     - Implement mutators: `listingCreate`, `listingPublish`, `quoteUpsert`, `quoteWithdraw`, `listingEndNow`, `listingAward`.
     - Enforce `lastMutationId + 1` ordering per client.
     - Derive actor from session only.
     - Enforce business rules (owner-only transitions, no self-bid, min-step improvement, listing status checks).
     - On handled errors, acknowledge mutation ID and return structured error list.
   - **Done when**:
     - Duplicate mutation IDs are skipped idempotently.
     - Out-of-order future IDs are rejected.
     - Failed business mutation still advances mutation pointer.

4. Pull pipeline with CVR diffing
   - **Files**: `packages/api/src/replicache/pull.ts`, `packages/api/src/replicache/cvr.ts`, `packages/api/src/replicache/cache.ts`, `packages/api/src/auction/read-model.ts`
   - **What**:
     - Build per-role keyspace docs (`card/*`, `feed/home/*`, `listing/*`, `leaderboard/*`, `my-quote/*`, `private-quote/*`, `notification/*`).
     - Compute `put`/`del` from previous vs next CVR maps.
     - Return `clear` patch on first pull or role-scope change.
     - Return `lastMutationIDChanges` from client CVR delta.
     - Support in-memory CVR cache first, Redis adapter second.
   - **Done when**:
     - First pull produces `clear + put`.
     - Incremental pull produces minimal `del/put`.
     - Cache miss safely rebases without data leak.

5. Realtime channels (poke + presence)
   - **Files**: `apps/server/src/realtime/ws.ts`, `apps/server/src/realtime/poke.ts`, `apps/server/src/realtime/presence.ts`, `apps/server/src/index.ts`, `packages/api/src/replicache/events.ts`
   - **What**:
     - Expose websocket endpoint and channel subscription protocol.
     - Broadcast poke channels: `poke:listing:<listingId>`, `poke:feed:home`, `poke:user:<userId>`.
     - Implement presence channel `presence:listing:<listingId>` with 15s heartbeat and 45s TTL.
     - Emit poke events after push handling to trigger immediate client pulls.
   - **Done when**:
     - Active tabs pull shortly after server commit.
     - Presence count updates every 2-3s (or on join/leave bursts).

6. Web app integration for instant UX
   - **Files**: `apps/web/src/lib/replicache/client.ts`, `apps/web/src/lib/realtime/socket.ts`, `apps/web/src/lib/auction/mutators.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/app/listing/[listingId]/page.tsx`, `apps/web/src/components/auction/*`
   - **What**:
     - Initialize Replicache with push/pull URLs and auth-aware naming.
     - Register auction mutators with optimistic local updates.
     - Subscribe homepage to `card/*` + `feed/home/*` and listing page to detail/leaderboard docs.
     - On websocket poke, call `rep.pull()` immediately.
     - Add developer status strip (`connected`, `last pull`, `pending mutations`).
   - **Done when**:
     - Local action updates instantly.
     - Other tabs converge quickly after poke.
     - Reconnected tab catches up to canonical state.

7. Demo scripts and smoke verification
   - **Files**: `scripts/demo/seed.ts`, `scripts/demo/bids.ts`, `scripts/demo/viewers.ts`, `package.json`
   - **What**:
     - Seed demo users and listings.
     - Run synthetic bid traffic with randomized jitter.
     - Run synthetic presence clients targeting configurable viewer count.
     - Add scripts: `demo:seed`, `demo:bids`, `demo:viewers`.
   - **Done when**:
     - Live demo can show create -> bid race -> reconnect -> end -> award with convergence.

## Verification checklist

- `bun run check-types`
- `bun run db:generate && bun run db:migrate`
- `bun run dev` with two browser tabs and one incognito session
- Manual assertions:
  - owner cannot bid own listing
  - lower/equal bid is rejected and mutation cursor still advances
  - offline tab reconnects and converges
  - presence drops within TTL after tab close
