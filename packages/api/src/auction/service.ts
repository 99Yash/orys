/**
 * Server-side auction business logic.
 * All mutations run inside a serializable Drizzle transaction.
 */

import { and, eq, sql, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { listing, quote } from "@orys/db/schema";
import type * as schema from "@orys/db/schema";

const ANTI_SNIPE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const ANTI_SNIPE_EXTENSION_MS = 3 * 60 * 1000; // 3 minutes

type Tx = NodePgDatabase<typeof schema>;

export class AuctionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuctionError";
  }
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

  if (!row) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (row.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can publish");
  if (row.status !== "DRAFT")
    throw new AuctionError(
      "INVALID_STATE",
      `Cannot publish from ${row.status}`,
    );

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
  // 1. Validate listing
  const [row] = await tx
    .select()
    .from(listing)
    .where(eq(listing.id, args.listingId));

  if (!row) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (row.status !== "LIVE")
    throw new AuctionError("INVALID_STATE", "Listing is not live");
  if (row.endsAt.getTime() < Date.now())
    throw new AuctionError("EXPIRED", "Listing has expired");
  if (row.ownerId === userId)
    throw new AuctionError("SELF_BID", "Cannot bid on own listing");

  // 2. Validate improvement over current best
  const [bestQuote] = await tx
    .select({ amountCents: quote.amountCents })
    .from(quote)
    .where(
      and(eq(quote.listingId, args.listingId), eq(quote.status, "ACTIVE")),
    )
    .orderBy(desc(quote.amountCents))
    .limit(1);

  if (bestQuote) {
    const minRequired = bestQuote.amountCents + row.minStepCents;
    if (args.amountCents < minRequired) {
      throw new AuctionError(
        "BID_TOO_LOW",
        `Bid must be at least ${minRequired} cents`,
      );
    }
  }

  // 3. Upsert (one active quote per user per listing)
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

  // 4. Anti-snipe: extend listing if bid within threshold of end
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
  }

  // 5. Bump listing rowVersion for card/feed updates
  await tx
    .update(listing)
    .set({ rowVersion: sql`${listing.rowVersion} + 1` })
    .where(eq(listing.id, args.listingId));
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

  if (!row) throw new AuctionError("NOT_FOUND", "Quote not found");
  if (row.userId !== userId)
    throw new AuctionError("FORBIDDEN", "Not your quote");
  if (row.status !== "ACTIVE")
    throw new AuctionError("INVALID_STATE", "Quote is not active");

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

  if (!row) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (row.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can end");
  if (row.status !== "LIVE")
    throw new AuctionError("INVALID_STATE", `Cannot end from ${row.status}`);

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

  if (!row) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (row.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can award");
  if (row.status !== "ENDED")
    throw new AuctionError(
      "INVALID_STATE",
      `Cannot award from ${row.status}`,
    );

  const [q] = await tx
    .select()
    .from(quote)
    .where(eq(quote.id, args.quoteId));

  if (!q) throw new AuctionError("NOT_FOUND", "Quote not found");
  if (q.listingId !== args.listingId)
    throw new AuctionError("INVALID_STATE", "Quote is for different listing");
  if (q.status !== "ACTIVE")
    throw new AuctionError("INVALID_STATE", "Quote is not active");

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
