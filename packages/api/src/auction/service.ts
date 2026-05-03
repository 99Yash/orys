/**
 * Server-side auction business logic.
 * All mutations run inside a Drizzle transaction (caller's choice of isolation).
 *
 * Business rules live in `./rules.ts` and are shared with the browser client.
 * This file is only responsible for: read snapshots from DB, call the rule,
 * write the side effects.
 */

import { and, eq, ne, lt, sql, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { listing, quote } from "@orys/db/schema";
import type * as schema from "@orys/db/schema";
import {
  AuctionError,
  checkListingAward,
  checkListingEndNow,
  checkListingPublish,
  checkQuoteUpsert,
  checkQuoteWithdraw,
  type ListingSnapshot,
  type QuoteSnapshot,
} from "@orys/auction-core";

export { AuctionError } from "@orys/auction-core";

const ANTI_SNIPE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const ANTI_SNIPE_EXTENSION_MS = 3 * 60 * 1000; // 3 minutes

type Tx = NodePgDatabase<typeof schema>;

function listingRowToSnapshot(
  row: typeof listing.$inferSelect,
): ListingSnapshot {
  return {
    ownerId: row.ownerId,
    status: row.status,
    endsAtMs: row.endsAt.getTime(),
    minStepCents: row.minStepCents,
  };
}

function quoteRowToSnapshot(row: typeof quote.$inferSelect): QuoteSnapshot {
  return {
    listingId: row.listingId,
    userId: row.userId,
    status: row.status,
  };
}

/**
 * Transition all expired LIVE listings to ENDED.
 * Call this inside a serializable transaction before reading listing state.
 * Returns the number of listings transitioned.
 */
export async function expireListings(tx: Tx): Promise<number> {
  const result = await tx
    .update(listing)
    .set({
      status: "ENDED",
      rowVersion: sql`${listing.rowVersion} + 1`,
    })
    .where(and(eq(listing.status, "LIVE"), lt(listing.endsAt, new Date())))
    .returning({ id: listing.id });

  return result.length;
}

export async function listingCreate(
  tx: Tx,
  userId: string,
  args: {
    listingId: string;
    title: string;
    description?: string;
    endsAtMs: number;
    minStepCents: number;
    currency: string;
  },
) {
  await tx.insert(listing).values({
    id: args.listingId,
    ownerId: userId,
    title: args.title,
    description: args.description ?? null,
    endsAt: new Date(args.endsAtMs),
    minStepCents: args.minStepCents,
    currency: args.currency || "USD",
    status: "DRAFT",
    rowVersion: 0,
  });
}

export async function listingPublish(
  tx: Tx,
  userId: string,
  args: { listingId: string },
) {
  const [row] = await tx
    .select()
    .from(listing)
    .where(eq(listing.id, args.listingId));

  checkListingPublish({
    listing: row ? { ownerId: row.ownerId, status: row.status } : null,
    userId,
  });

  await tx
    .update(listing)
    .set({
      status: "LIVE",
      rowVersion: sql`${listing.rowVersion} + 1`,
    })
    .where(eq(listing.id, args.listingId));
}

export async function quoteUpsert(
  tx: Tx,
  userId: string,
  args: {
    listingId: string;
    quoteId: string;
    amountCents: number;
  },
) {
  // 1. Read listing snapshot
  const [row] = await tx
    .select()
    .from(listing)
    .where(eq(listing.id, args.listingId));

  // 2. Read best other-bidder amount (excluding the current user)
  const [bestQuote] = await tx
    .select({ amountCents: quote.amountCents })
    .from(quote)
    .where(
      and(
        eq(quote.listingId, args.listingId),
        eq(quote.status, "ACTIVE"),
        ne(quote.userId, userId),
      ),
    )
    .orderBy(desc(quote.amountCents))
    .limit(1);

  // 3. Apply shared rule
  checkQuoteUpsert({
    listing: row ? listingRowToSnapshot(row) : null,
    bestOtherCents: bestQuote?.amountCents ?? 0,
    userId,
    amountCents: args.amountCents,
  });

  // After this point `row` is guaranteed non-null (rule throws otherwise)
  if (!row) throw new AuctionError("NOT_FOUND", "Listing not found");

  // 4. Upsert (one active quote per user per listing)
  const [existing] = await tx
    .select()
    .from(quote)
    .where(
      and(eq(quote.userId, userId), eq(quote.listingId, args.listingId)),
    );

  if (existing) {
    await tx
      .update(quote)
      .set({
        id: args.quoteId,
        amountCents: args.amountCents,
        status: "ACTIVE",
        rowVersion: sql`${quote.rowVersion} + 1`,
      })
      .where(eq(quote.id, existing.id));
  } else {
    await tx.insert(quote).values({
      id: args.quoteId,
      listingId: args.listingId,
      userId,
      amountCents: args.amountCents,
      status: "ACTIVE",
      rowVersion: 0,
    });
  }

  // 5. Anti-snipe: extend listing if bid within threshold of end.
  //    Otherwise just bump rowVersion for card/feed updates.
  const timeUntilEnd = row.endsAt.getTime() - Date.now();
  if (timeUntilEnd > 0 && timeUntilEnd < ANTI_SNIPE_THRESHOLD_MS) {
    const newEndsAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
    await tx
      .update(listing)
      .set({
        endsAt: newEndsAt,
        rowVersion: sql`${listing.rowVersion} + 1`,
      })
      .where(eq(listing.id, args.listingId));
  } else {
    await tx
      .update(listing)
      .set({ rowVersion: sql`${listing.rowVersion} + 1` })
      .where(eq(listing.id, args.listingId));
  }
}

export async function quoteWithdraw(
  tx: Tx,
  userId: string,
  args: { listingId: string; quoteId: string },
) {
  const [row] = await tx
    .select()
    .from(quote)
    .where(eq(quote.id, args.quoteId));

  checkQuoteWithdraw({
    quote: row ? quoteRowToSnapshot(row) : null,
    userId,
  });

  await tx
    .update(quote)
    .set({
      status: "WITHDRAWN",
      rowVersion: sql`${quote.rowVersion} + 1`,
    })
    .where(eq(quote.id, args.quoteId));

  // Bump listing for feed update
  await tx
    .update(listing)
    .set({ rowVersion: sql`${listing.rowVersion} + 1` })
    .where(eq(listing.id, args.listingId));
}

export async function listingEndNow(
  tx: Tx,
  userId: string,
  args: { listingId: string },
) {
  const [row] = await tx
    .select()
    .from(listing)
    .where(eq(listing.id, args.listingId));

  checkListingEndNow({
    listing: row ? { ownerId: row.ownerId, status: row.status } : null,
    userId,
  });

  await tx
    .update(listing)
    .set({
      status: "ENDED",
      endsAt: new Date(),
      rowVersion: sql`${listing.rowVersion} + 1`,
    })
    .where(eq(listing.id, args.listingId));
}

export async function listingAward(
  tx: Tx,
  userId: string,
  args: { listingId: string; quoteId: string },
) {
  const [row] = await tx
    .select()
    .from(listing)
    .where(eq(listing.id, args.listingId));

  const [q] = await tx
    .select()
    .from(quote)
    .where(eq(quote.id, args.quoteId));

  checkListingAward({
    listing: row ? { ownerId: row.ownerId, status: row.status } : null,
    quote: q ? quoteRowToSnapshot(q) : null,
    listingId: args.listingId,
    userId,
  });

  await tx
    .update(listing)
    .set({
      status: "AWARDED",
      rowVersion: sql`${listing.rowVersion} + 1`,
    })
    .where(eq(listing.id, args.listingId));

  await tx
    .update(quote)
    .set({
      status: "AWARDED",
      rowVersion: sql`${quote.rowVersion} + 1`,
    })
    .where(eq(quote.id, args.quoteId));
}
