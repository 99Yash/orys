import { IDB_KEY, type QuoteStatus } from "@orys/auction-core";
import type {
  ReadonlyJSONValue,
  ReadTransaction,
  WriteTransaction,
} from "replicache";

/** Bidder's own active quote on a listing. Lives at `my-quote/<listingId>`. */
export type MyQuoteDoc = {
  quoteId: string;
  listingId: string;
  amountCents: number;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
};

/** Anonymized leaderboard row. Lives at `leaderboard/<listingId>/<rank>`. */
export type LeaderboardDoc = {
  rank: number;
  amountCents: number;
  status: QuoteStatus;
  /** Only present when the viewer is the listing owner. */
  userId?: string;
  /** Only present when the viewer is the listing owner. */
  quoteId?: string;
  createdAt: string;
} & { [k: string]: ReadonlyJSONValue | undefined };

/** Owner-only full quote detail. Lives at `private-quote/<listingId>/<quoteId>`. */
export type PrivateQuoteDoc = {
  quoteId: string;
  listingId: string;
  userId: string;
  amountCents: number;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * Static read/write helpers for the quote keyspace. Owns IDB key
 * construction and shape casting for `my-quote/*`, `leaderboard/*`,
 * and `private-quote/*`.
 */
export class QuoteManager {
  // ---- reads ------------------------------------------------------------

  static async getMyQuote(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<MyQuoteDoc | undefined> {
    return (await tx.get(IDB_KEY.MY_QUOTE({ listingId }))) as
      | MyQuoteDoc
      | undefined;
  }

  static async getPrivateQuote(
    tx: ReadTransaction,
    listingId: string,
    quoteId: string,
  ): Promise<PrivateQuoteDoc | undefined> {
    return (await tx.get(
      IDB_KEY.PRIVATE_QUOTE({ listingId, quoteId }),
    )) as PrivateQuoteDoc | undefined;
  }

  static async scanLeaderboard(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<LeaderboardDoc[]> {
    const out: LeaderboardDoc[] = [];
    for await (const value of tx
      .scan({ prefix: IDB_KEY.LEADERBOARD({ listingId }) })
      .values()) {
      out.push(value as LeaderboardDoc);
    }
    return out;
  }

  /**
   * Highest ACTIVE bid amount on the listing that does NOT belong to the
   * viewer. Used by the client mutator to mirror the server's improvement
   * constraint (`bestOtherCents + minStep`).
   *
   * Leaderboard hides `userId` for non-owners, so we identify our own entry
   * by amount-match against `my-quote`.
   */
  static async bestOtherCents(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<number> {
    const myQuote = await QuoteManager.getMyQuote(tx, listingId);
    const myAmount =
      myQuote && myQuote.status === "ACTIVE" ? myQuote.amountCents : undefined;

    let best = 0;
    for await (const value of tx
      .scan({ prefix: IDB_KEY.LEADERBOARD({ listingId }) })
      .values()) {
      const e = value as LeaderboardDoc;
      if (e.status !== "ACTIVE") continue;
      if (typeof e.amountCents !== "number") continue;
      if (myAmount !== undefined && e.amountCents === myAmount) continue;
      if (e.amountCents > best) best = e.amountCents;
    }
    return best;
  }

  // ---- writes -----------------------------------------------------------

  static async setMyQuote(
    tx: WriteTransaction,
    listingId: string,
    doc: MyQuoteDoc,
  ): Promise<void> {
    await tx.set(IDB_KEY.MY_QUOTE({ listingId }), doc);
  }
}
