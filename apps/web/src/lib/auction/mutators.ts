import type { WriteTransaction } from "replicache";
import {
  AuctionError,
  checkListingAward,
  checkListingEndNow,
  checkListingPublish,
  checkQuoteUpsert,
  checkQuoteWithdraw,
  type QuoteSnapshot,
} from "@orys/auction-core";
import { ListingManager } from "./managers/listing-manager";
import { QuoteManager } from "./managers/quote-manager";

/**
 * Client-side mutators for optimistic UI updates.
 *
 * Each mutator runs the same `check*` rule the server runs in
 * `packages/api/src/auction/service.ts`, against snapshots read from local
 * Replicache state via the Manager classes. If the rule throws, Replicache
 * rolls back the optimistic write AND skips pushing the mutation to the
 * server — saving a wasted round-trip and avoiding the "accept then revert"
 * UX.
 *
 * Bound to the current `userId` at construction time so the rule has a
 * stable identity to compare ownership against.
 */
export function makeAuctionMutators(userId: string | null) {
  function requireUser(): string {
    if (!userId) {
      throw new AuctionError(
        "UNAUTHENTICATED",
        "Sign in to perform this action",
      );
    }
    return userId;
  }

  return {
    async listingCreate(
      tx: WriteTransaction,
      args: {
        listingId: string;
        title: string;
        description?: string;
        endsAtMs: number;
        minStepCents: number;
        currency: string;
      },
    ) {
      const me = requireUser();
      const card = ListingManager.createCard({
        listingId: args.listingId,
        title: args.title,
        ownerId: me,
        endsAtMs: args.endsAtMs,
        minStepCents: args.minStepCents,
        currency: args.currency,
      });
      await ListingManager.setCard(tx, args.listingId, card);
      await ListingManager.setDetail(tx, args.listingId, {
        ...card,
        description: args.description ?? null,
      });
    },

    async listingPublish(tx: WriteTransaction, args: { listingId: string }) {
      const me = requireUser();
      const listing = await ListingManager.readSnapshot(tx, args.listingId);
      checkListingPublish({ listing, userId: me });

      await ListingManager.patchCard(tx, args.listingId, { status: "LIVE" });
      await ListingManager.patchDetail(tx, args.listingId, { status: "LIVE" });
    },

    async quoteUpsert(
      tx: WriteTransaction,
      args: {
        listingId: string;
        quoteId: string;
        amountCents: number;
      },
    ) {
      const me = requireUser();
      const listing = await ListingManager.readSnapshot(tx, args.listingId);
      const bestOtherCents = await QuoteManager.bestOtherCents(
        tx,
        args.listingId,
      );

      checkQuoteUpsert({
        listing,
        bestOtherCents,
        userId: me,
        amountCents: args.amountCents,
      });

      const myQuote = await QuoteManager.getMyQuote(tx, args.listingId);
      const isUpdate = myQuote !== undefined;
      const now = new Date().toISOString();

      await QuoteManager.setMyQuote(tx, args.listingId, {
        quoteId: args.quoteId,
        listingId: args.listingId,
        amountCents: args.amountCents,
        status: "ACTIVE",
        createdAt: isUpdate ? myQuote!.createdAt : now,
        updatedAt: now,
      });

      const card = await ListingManager.getCard(tx, args.listingId);
      if (card) {
        await ListingManager.patchCard(tx, args.listingId, {
          bestAmountCents: Math.max(card.bestAmountCents ?? 0, args.amountCents),
          quoteCount: isUpdate
            ? (card.quoteCount ?? 0)
            : (card.quoteCount ?? 0) + 1,
        });
      }
    },

    async quoteWithdraw(
      tx: WriteTransaction,
      args: { listingId: string; quoteId: string },
    ) {
      const me = requireUser();
      const myQuote = await QuoteManager.getMyQuote(tx, args.listingId);
      const quote: QuoteSnapshot | null = myQuote
        ? {
            listingId: myQuote.listingId,
            userId: me,
            status: myQuote.status,
          }
        : null;
      checkQuoteWithdraw({ quote, userId: me });

      await QuoteManager.setMyQuote(tx, args.listingId, {
        ...myQuote!,
        status: "WITHDRAWN",
        updatedAt: new Date().toISOString(),
      });
    },

    async listingEndNow(tx: WriteTransaction, args: { listingId: string }) {
      const me = requireUser();
      const listing = await ListingManager.readSnapshot(tx, args.listingId);
      checkListingEndNow({ listing, userId: me });

      const now = new Date().toISOString();
      await ListingManager.patchCard(tx, args.listingId, {
        status: "ENDED",
        endsAt: now,
      });
      await ListingManager.patchDetail(tx, args.listingId, {
        status: "ENDED",
        endsAt: now,
      });
    },

    async listingAward(
      tx: WriteTransaction,
      args: { listingId: string; quoteId: string },
    ) {
      const me = requireUser();
      const listing = await ListingManager.readSnapshot(tx, args.listingId);
      const privateQuote = await QuoteManager.getPrivateQuote(
        tx,
        args.listingId,
        args.quoteId,
      );
      const quote: QuoteSnapshot | null = privateQuote
        ? {
            listingId: privateQuote.listingId,
            userId: privateQuote.userId,
            status: privateQuote.status,
          }
        : null;
      checkListingAward({
        listing,
        quote,
        listingId: args.listingId,
        userId: me,
      });

      await ListingManager.patchCard(tx, args.listingId, { status: "AWARDED" });
      await ListingManager.patchDetail(tx, args.listingId, {
        status: "AWARDED",
      });
    },
  };
}

export type AuctionMutators = ReturnType<typeof makeAuctionMutators>;
