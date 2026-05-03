/**
 * Replicache push handler.
 * Processes mutations sequentially with error-mode fallback.
 */

import { eq } from "drizzle-orm";
import { db } from "@orys/db";
import {
  replicacheClientGroup,
  replicacheClient,
} from "@orys/db/schema";
import type * as schema from "@orys/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PushRequest, Mutation } from "./schema";
import {
  listingCreate,
  listingPublish,
  quoteUpsert,
  quoteWithdraw,
  listingEndNow,
  listingAward,
  expireListings,
  AuctionError,
} from "../auction/service";

type Tx = NodePgDatabase<typeof schema>;

// Postgres error codes safe to retry: serialization_failure + deadlock_detected
const RETRYABLE_PG_CODES = new Set(["40001", "40P01"]);
const MAX_TX_ATTEMPTS = 20;

function isRetryablePgError(err: unknown): boolean {
  // Drizzle wraps the pg error: thrown is `new Error("Failed query: ...")`
  // with the original pg error (carrying `code: "40001"`) on `.cause`.
  // Walk the chain to find the underlying code.
  let cur: unknown = err;
  for (let depth = 0; cur && typeof cur === "object" && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && RETRYABLE_PG_CODES.has(code)) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Run a transaction-bearing function and retry only on Postgres
 * serialization/deadlock failures. Domain errors (AuctionError) and any
 * other non-retryable error short-circuit immediately.
 */
async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_TX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryablePgError(err)) throw err;
      lastErr = err;
      // Jittered exponential backoff capped at 200ms
      const delay = Math.min(5 * 2 ** attempt, 200) + Math.random() * 5;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

type MutationError = {
  name: string;
  code: string;
  message: string;
};

type PushResult = {
  errors: MutationError[];
  /** Listing IDs that were modified (for poke targeting) */
  affectedListingIds: Set<string>;
};

const mutatorMap: Record<
  string,
  (tx: Tx, userId: string, args: unknown) => Promise<void>
> = {
  listingCreate: (tx, userId, args) =>
    listingCreate(tx, userId, args as Parameters<typeof listingCreate>[2]),
  listingPublish: (tx, userId, args) =>
    listingPublish(tx, userId, args as Parameters<typeof listingPublish>[2]),
  quoteUpsert: (tx, userId, args) =>
    quoteUpsert(tx, userId, args as Parameters<typeof quoteUpsert>[2]),
  quoteWithdraw: (tx, userId, args) =>
    quoteWithdraw(tx, userId, args as Parameters<typeof quoteWithdraw>[2]),
  listingEndNow: (tx, userId, args) =>
    listingEndNow(tx, userId, args as Parameters<typeof listingEndNow>[2]),
  listingAward: (tx, userId, args) =>
    listingAward(tx, userId, args as Parameters<typeof listingAward>[2]),
};

async function processMutation(
  tx: Tx,
  clientGroupID: string,
  userId: string,
  mutation: Mutation,
  errorMode: boolean,
): Promise<void> {
  // 1. Ensure client group exists (idempotent upsert; preserves cvrVersion)
  await tx
    .insert(replicacheClientGroup)
    .values({ id: clientGroupID, userId, cvrVersion: 0 })
    .onConflictDoNothing();

  const [group] = await tx
    .select()
    .from(replicacheClientGroup)
    .where(eq(replicacheClientGroup.id, clientGroupID));

  if (group && group.userId !== userId) {
    throw new Error("Client group belongs to different user");
  }

  // 2. Get or create client
  const [client] = await tx
    .select()
    .from(replicacheClient)
    .where(eq(replicacheClient.id, mutation.clientID));

  const lastMutationId = client?.lastMutationId ?? 0;
  const nextMutationId = lastMutationId + 1;

  // 3. Skip already-processed mutations
  if (mutation.id < nextMutationId) {
    return;
  }

  // 4. Reject future mutations (gap)
  if (mutation.id > nextMutationId) {
    throw new Error(
      `Mutation ID gap: expected ${nextMutationId}, got ${mutation.id}`,
    );
  }

  // 5. Apply mutation if not in error mode
  if (!errorMode) {
    const mutator = mutatorMap[mutation.name];
    if (!mutator) {
      throw new Error(`Unknown mutation: ${mutation.name}`);
    }
    await mutator(tx, userId, mutation.args);
  }

  // 6. Advance cursor (always, even in error mode) via idempotent upsert
  await tx
    .insert(replicacheClient)
    .values({
      id: mutation.clientID,
      clientGroupId: clientGroupID,
      lastMutationId: nextMutationId,
    })
    .onConflictDoUpdate({
      target: replicacheClient.id,
      set: { lastMutationId: nextMutationId },
    });
}

function extractListingId(args: unknown): string | undefined {
  if (
    args &&
    typeof args === "object" &&
    "listingId" in args &&
    typeof (args as { listingId: unknown }).listingId === "string"
  ) {
    return (args as { listingId: string }).listingId;
  }
  return undefined;
}

export async function handlePush(
  body: PushRequest,
  userId: string,
): Promise<PushResult> {
  const errors: MutationError[] = [];
  const affectedListingIds = new Set<string>();

  for (const mutation of body.mutations) {
    const listingId = extractListingId(mutation.args);

    try {
      await runWithRetry(() =>
        db.transaction(
          async (tx) => {
            await expireListings(tx as unknown as Tx);
            await processMutation(
              tx as unknown as Tx,
              body.clientGroupID,
              userId,
              mutation,
              false,
            );
          },
          { isolationLevel: "serializable" },
        ),
      );

      if (listingId) affectedListingIds.add(listingId);
    } catch (error) {
      // Error mode: advance cursor without applying mutation.
      // Read-committed is sufficient and avoids predicate-lock 40001s —
      // all writes here are idempotent (ON CONFLICT upserts).
      try {
        await runWithRetry(() =>
          db.transaction(
            async (tx) => {
              await processMutation(
                tx as unknown as Tx,
                body.clientGroupID,
                userId,
                mutation,
                true,
              );
            },
            { isolationLevel: "read committed" },
          ),
        );
      } catch {
        // If even error-mode fails after retries, we can't advance the cursor.
        console.error("Error-mode mutation failed:", error);
      }

      if (error instanceof AuctionError) {
        errors.push({
          name: mutation.name,
          code: error.code,
          message: error.message,
        });
      } else if (isRetryablePgError(error)) {
        errors.push({
          name: mutation.name,
          code: "CONTENTION",
          message: "Listing is busy, please retry",
        });
      } else {
        errors.push({
          name: mutation.name,
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (listingId) affectedListingIds.add(listingId);
    }
  }

  return { errors, affectedListingIds };
}
