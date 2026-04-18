/**
 * Replicache pull handler.
 * Computes CVR diff and returns minimal patch.
 * Supports anonymous pulls (userId=null) for public listing data.
 */

import { eq, and, or, inArray, desc, sql } from "drizzle-orm";
import { db } from "@orys/db";
import {
  replicacheClientGroup,
  replicacheClient,
  listing,
  quote,
} from "@orys/db/schema";
import type { PullRequest, PullCookie } from "./schema";
import {
  generateCVR,
  getPutsSince,
  getDelsSince,
} from "./cvr";
import * as cvrCache from "./cache";
import { IDB } from "./idb-keys";
import { expireListings } from "../auction/service";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@orys/db/schema";

type Tx = NodePgDatabase<typeof schema>;

type PatchOp =
  | { op: "clear" }
  | { op: "del"; key: string }
  | { op: "put"; key: string; value: Record<string, unknown> };

type PullResponse = {
  cookie: PullCookie;
  lastMutationIDChanges: Record<string, number>;
  patch: PatchOp[];
};

function buildCardDoc(
  row: typeof listing.$inferSelect,
  quoteStats: { bestAmountCents: number | null; quoteCount: number },
) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    bestAmountCents: quoteStats.bestAmountCents ?? 0,
    quoteCount: quoteStats.quoteCount,
    endsAt: row.endsAt.toISOString(),
    minStepCents: row.minStepCents,
    currency: row.currency,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildListingDoc(
  row: typeof listing.$inferSelect,
  quoteStats: { bestAmountCents: number | null; quoteCount: number },
) {
  return {
    ...buildCardDoc(row, quoteStats),
    description: row.description,
  };
}

function buildLeaderboardDoc(
  q: typeof quote.$inferSelect,
  rank: number,
  isOwner: boolean,
) {
  return {
    rank,
    amountCents: q.amountCents,
    status: q.status,
    userId: isOwner ? q.userId : undefined,
    quoteId: isOwner ? q.id : undefined,
    createdAt: q.createdAt.toISOString(),
  };
}

export async function handlePull(
  body: PullRequest,
  userId: string | null,
): Promise<PullResponse> {
  const { baseCVR, previousCVR } = cvrCache.getBaseCVR(
    body.clientGroupID,
    body.cookie,
  );

  const result = await db.transaction(
    async (rawTx) => {
      const tx = rawTx as unknown as Tx;

      // 0. Expire LIVE listings past their endsAt
      await expireListings(tx);

      // 1. Get or create client group (only for authenticated users)
      let cvrVersion = 0;
      if (userId) {
        const [group] = await tx
          .select()
          .from(replicacheClientGroup)
          .where(eq(replicacheClientGroup.id, body.clientGroupID));

        if (!group) {
          await tx.insert(replicacheClientGroup).values({
            id: body.clientGroupID,
            userId,
            cvrVersion: 0,
          });
        }
        cvrVersion = group?.cvrVersion ?? 0;
      }

      // 2. Fetch visible listings
      // Public: all non-draft listings. Authed owners also see their drafts.
      const listingConditions = [
        eq(listing.status, "LIVE"),
        eq(listing.status, "ENDED"),
        eq(listing.status, "AWARDED"),
      ];
      if (userId) {
        listingConditions.push(
          and(eq(listing.status, "DRAFT"), eq(listing.ownerId, userId))!,
        );
      }

      const listingsMeta = await tx
        .select({ id: listing.id, rowVersion: listing.rowVersion })
        .from(listing)
        .where(or(...listingConditions));

      // 3. Quotes: only for authenticated users
      const ownedListingIds = listingsMeta.map((l) => l.id);
      let quotesMeta: { id: string; rowVersion: number }[] = [];

      if (userId && ownedListingIds.length > 0) {
        quotesMeta = await tx
          .select({ id: quote.id, rowVersion: quote.rowVersion })
          .from(quote)
          .where(
            or(
              eq(quote.userId, userId),
              inArray(quote.listingId, ownedListingIds),
            ),
          );
      }

      // 4. Clients meta (only for authenticated)
      let clientsMeta: { id: string; rowVersion: number }[] = [];
      if (userId) {
        clientsMeta = await tx
          .select({
            id: replicacheClient.id,
            rowVersion: replicacheClient.lastMutationId,
          })
          .from(replicacheClient)
          .where(eq(replicacheClient.clientGroupId, body.clientGroupID));
      }

      // 5. Generate next CVR and compute diffs
      const nextCVR = generateCVR({ clientsMeta, listingsMeta, quotesMeta });

      const listingPuts = getPutsSince(nextCVR.listings, baseCVR.listings);
      const listingDels = getDelsSince(nextCVR.listings, baseCVR.listings);
      const quotePuts = getPutsSince(nextCVR.quotes, baseCVR.quotes);
      const quoteDels = getDelsSince(nextCVR.quotes, baseCVR.quotes);
      const clientPuts = getPutsSince(nextCVR.clients, baseCVR.clients);

      // 6. Fetch full data for puts
      let listingRows: (typeof listing.$inferSelect)[] = [];
      if (listingPuts.length > 0) {
        listingRows = await tx
          .select()
          .from(listing)
          .where(inArray(listing.id, listingPuts));
      }

      let quoteRows: (typeof quote.$inferSelect)[] = [];
      if (quotePuts.length > 0) {
        quoteRows = await tx
          .select()
          .from(quote)
          .where(inArray(quote.id, quotePuts));
      }

      // 7. Quote stats for cards
      const allListingIds = [
        ...new Set([...listingPuts, ...listingRows.map((l) => l.id)]),
      ];

      const quoteStatsMap = new Map<
        string,
        { bestAmountCents: number | null; quoteCount: number }
      >();
      if (allListingIds.length > 0) {
        const statsRows = await tx
          .select({
            listingId: quote.listingId,
            bestAmountCents: sql<number>`max(${quote.amountCents})`.as("best"),
            quoteCount: sql<number>`count(*)::int`.as("count"),
          })
          .from(quote)
          .where(
            and(
              inArray(quote.listingId, allListingIds),
              eq(quote.status, "ACTIVE"),
            ),
          )
          .groupBy(quote.listingId);

        for (const s of statsRows) {
          quoteStatsMap.set(s.listingId, {
            bestAmountCents: s.bestAmountCents,
            quoteCount: s.quoteCount,
          });
        }
      }

      const defaultStats = { bestAmountCents: null, quoteCount: 0 };

      // 8. lastMutationIDChanges
      const lastMutationIDChanges: Record<string, number> = {};
      for (const id of clientPuts) {
        const meta = nextCVR.clients.get(id);
        if (meta) lastMutationIDChanges[id] = meta.rowVersion;
      }

      // 9. Build patch
      const patch: PatchOp[] = [];

      if (!previousCVR) {
        patch.push({ op: "clear" });
      }

      for (const id of listingDels) {
        patch.push({ op: "del", key: IDB.card(id) });
        patch.push({ op: "del", key: IDB.listing(id) });
      }

      for (const row of listingRows) {
        const stats = quoteStatsMap.get(row.id) ?? defaultStats;
        patch.push({
          op: "put",
          key: IDB.card(row.id),
          value: buildCardDoc(row, stats),
        });
        patch.push({
          op: "put",
          key: IDB.listing(row.id),
          value: buildListingDoc(row, stats),
        });

        // Leaderboard: rebuild and clean up stale ranks
        const lbQuotes = await tx
          .select()
          .from(quote)
          .where(
            and(eq(quote.listingId, row.id), eq(quote.status, "ACTIVE")),
          )
          .orderBy(desc(quote.amountCents));

        const isOwner = userId !== null && row.ownerId === userId;
        for (let i = 0; i < lbQuotes.length; i++) {
          patch.push({
            op: "put",
            key: IDB.leaderboard(row.id, String(i + 1)),
            value: buildLeaderboardDoc(lbQuotes[i]!, i + 1, isOwner),
          });
        }
        // Delete stale ranks beyond current count.
        // Replicache treats del on non-existent keys as no-ops.
        // Clean up a bounded window to cover typical auction sizes.
        for (let i = lbQuotes.length + 1; i <= lbQuotes.length + 20; i++) {
          patch.push({
            op: "del",
            key: IDB.leaderboard(row.id, String(i)),
          });
        }
      }

      // Quote patches (only for authed users)
      for (const id of quoteDels) {
        patch.push({ op: "del", key: IDB.myQuote(id) });
        patch.push({ op: "del", key: IDB.privateQuote(id) });
      }

      for (const q of quoteRows) {
        if (userId && q.userId === userId) {
          patch.push({
            op: "put",
            key: IDB.myQuote(q.listingId),
            value: {
              quoteId: q.id,
              listingId: q.listingId,
              amountCents: q.amountCents,
              status: q.status,
              createdAt: q.createdAt.toISOString(),
              updatedAt: q.updatedAt.toISOString(),
            },
          });
        }

        const parentListing = listingRows.find((l) => l.id === q.listingId);
        const ownsListing =
          userId !== null && parentListing?.ownerId === userId;

        if (ownsListing) {
          patch.push({
            op: "put",
            key: IDB.privateQuote(q.listingId, q.id),
            value: {
              quoteId: q.id,
              listingId: q.listingId,
              userId: q.userId,
              amountCents: q.amountCents,
              status: q.status,
              createdAt: q.createdAt.toISOString(),
              updatedAt: q.updatedAt.toISOString(),
            },
          });
        }
      }

      // 10. Bump CVR version (only for authenticated)
      const previousCVRVersion = body.cookie?.order ?? cvrVersion;
      const nextCVRVersion = Math.max(previousCVRVersion, cvrVersion) + 1;

      if (userId) {
        await tx
          .update(replicacheClientGroup)
          .set({ cvrVersion: nextCVRVersion })
          .where(eq(replicacheClientGroup.id, body.clientGroupID));
      }

      const responseCookie: PullCookie = {
        clientGroupID: body.clientGroupID,
        order: nextCVRVersion,
      };

      return { nextCVR, responseCookie, patch, lastMutationIDChanges };
    },
    { isolationLevel: "serializable" },
  );

  // Cache CVR
  cvrCache.setCVR(
    result.responseCookie!.clientGroupID,
    result.responseCookie!.order,
    result.nextCVR,
  );

  if (body.cookie) {
    cvrCache.delCVR(body.clientGroupID, body.cookie.order);
  }

  return {
    cookie: result.responseCookie,
    lastMutationIDChanges: result.lastMutationIDChanges,
    patch: result.patch,
  };
}
