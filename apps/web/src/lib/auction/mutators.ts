import type { WriteTransaction } from "replicache";

/**
 * Client-side mutators for optimistic UI updates.
 * These mirror server mutations but run locally first.
 */
export const auctionMutators = {
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
    await tx.set(`card/${args.listingId}`, {
      id: args.listingId,
      title: args.title,
      status: "DRAFT",
      bestAmountCents: 0,
      quoteCount: 0,
      endsAt: new Date(args.endsAtMs).toISOString(),
      minStepCents: args.minStepCents,
      currency: args.currency,
      ownerId: "", // will be filled by server
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await tx.set(`listing/${args.listingId}`, {
      id: args.listingId,
      title: args.title,
      description: args.description ?? null,
      status: "DRAFT",
      bestAmountCents: 0,
      quoteCount: 0,
      endsAt: new Date(args.endsAtMs).toISOString(),
      minStepCents: args.minStepCents,
      currency: args.currency,
      ownerId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  async listingPublish(
    tx: WriteTransaction,
    args: { listingId: string },
  ) {
    const card = (await tx.get(`card/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (card) {
      await tx.set(`card/${args.listingId}`, {
        ...card,
        status: "LIVE",
        updatedAt: new Date().toISOString(),
      });
    }
    const detail = (await tx.get(`listing/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (detail) {
      await tx.set(`listing/${args.listingId}`, {
        ...detail,
        status: "LIVE",
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async quoteUpsert(
    tx: WriteTransaction,
    args: {
      listingId: string;
      quoteId: string;
      amountCents: number;
    },
  ) {
    // Optimistic: update my-quote
    await tx.set(`my-quote/${args.listingId}`, {
      quoteId: args.quoteId,
      listingId: args.listingId,
      amountCents: args.amountCents,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Optimistic: update card best amount
    const card = (await tx.get(`card/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (card) {
      const currentBest = (card.bestAmountCents as number) || 0;
      const currentCount = (card.quoteCount as number) || 0;
      await tx.set(`card/${args.listingId}`, {
        ...card,
        bestAmountCents: Math.max(currentBest, args.amountCents),
        quoteCount: currentCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async quoteWithdraw(
    tx: WriteTransaction,
    args: { listingId: string; quoteId: string },
  ) {
    const myQuote = (await tx.get(`my-quote/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (myQuote) {
      await tx.set(`my-quote/${args.listingId}`, {
        ...myQuote,
        status: "WITHDRAWN",
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async listingEndNow(
    tx: WriteTransaction,
    args: { listingId: string },
  ) {
    const card = (await tx.get(`card/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (card) {
      await tx.set(`card/${args.listingId}`, {
        ...card,
        status: "ENDED",
        endsAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const detail = (await tx.get(`listing/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (detail) {
      await tx.set(`listing/${args.listingId}`, {
        ...detail,
        status: "ENDED",
        endsAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async listingAward(
    tx: WriteTransaction,
    args: { listingId: string; quoteId: string },
  ) {
    const card = (await tx.get(`card/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (card) {
      await tx.set(`card/${args.listingId}`, {
        ...card,
        status: "AWARDED",
        updatedAt: new Date().toISOString(),
      });
    }
    const detail = (await tx.get(`listing/${args.listingId}`)) as Record<
      string,
      unknown
    > | null;
    if (detail) {
      await tx.set(`listing/${args.listingId}`, {
        ...detail,
        status: "AWARDED",
        updatedAt: new Date().toISOString(),
      });
    }
  },
};

export type AuctionMutators = typeof auctionMutators;
