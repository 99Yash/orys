import {
  IDB_KEY,
  type ListingSnapshot,
  type ListingStatus,
} from "@orys/auction-core";
import type {
  ReadonlyJSONValue,
  ReadTransaction,
  WriteTransaction,
} from "replicache";

/**
 * Public homepage card. Lives at `card/<listingId>`. Visible to all
 * (anonymous and authenticated alike).
 */
export type CardDoc = {
  id: string;
  title: string;
  status: ListingStatus;
  bestAmountCents: number;
  quoteCount: number;
  endsAt: string;
  minStepCents: number;
  currency: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
} & { [k: string]: ReadonlyJSONValue | undefined };

/**
 * Listing detail. Lives at `listing/<listingId>`. Same as CardDoc plus
 * description (shown on the detail page, not the homepage feed).
 */
export type ListingDoc = CardDoc & { description: string | null };

/**
 * Static read/write helpers for the listing keyspace. Owns all
 * `tx.get` / `tx.set` / `tx.scan` for `card/*` and `listing/*` so callers
 * never construct keys or cast doc shapes themselves.
 */
export class ListingManager {
  // ---- reads ------------------------------------------------------------

  static async getCard(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<CardDoc | undefined> {
    return (await tx.get(IDB_KEY.CARD({ listingId }))) as CardDoc | undefined;
  }

  static async getDetail(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<ListingDoc | undefined> {
    return (await tx.get(IDB_KEY.LISTING({ listingId }))) as
      | ListingDoc
      | undefined;
  }

  static async scanCards(tx: ReadTransaction): Promise<CardDoc[]> {
    const out: CardDoc[] = [];
    for await (const value of tx.scan({ prefix: IDB_KEY.CARD() }).values()) {
      out.push(value as CardDoc);
    }
    return out;
  }

  /** Listing-shaped snapshot the auction-core rules expect. */
  static async readSnapshot(
    tx: ReadTransaction,
    listingId: string,
  ): Promise<ListingSnapshot | null> {
    const card = await ListingManager.getCard(tx, listingId);
    if (!card) return null;
    return {
      ownerId: card.ownerId,
      status: card.status,
      endsAtMs: new Date(card.endsAt).getTime(),
      minStepCents: card.minStepCents,
    };
  }

  // ---- pure constructors ------------------------------------------------

  static createCard(args: {
    listingId: string;
    title: string;
    ownerId: string;
    endsAtMs: number;
    minStepCents: number;
    currency: string;
  }): CardDoc {
    const now = new Date().toISOString();
    return {
      id: args.listingId,
      title: args.title,
      status: "DRAFT",
      bestAmountCents: 0,
      quoteCount: 0,
      endsAt: new Date(args.endsAtMs).toISOString(),
      minStepCents: args.minStepCents,
      currency: args.currency,
      ownerId: args.ownerId,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ---- writes -----------------------------------------------------------

  static async setCard(
    tx: WriteTransaction,
    listingId: string,
    card: CardDoc,
  ): Promise<void> {
    await tx.set(IDB_KEY.CARD({ listingId }), card);
  }

  static async setDetail(
    tx: WriteTransaction,
    listingId: string,
    detail: ListingDoc,
  ): Promise<void> {
    await tx.set(IDB_KEY.LISTING({ listingId }), detail);
  }

  /**
   * Patch a card with a partial update. No-op if no card exists locally.
   * Always bumps `updatedAt`.
   */
  static async patchCard(
    tx: WriteTransaction,
    listingId: string,
    patch: Partial<CardDoc>,
  ): Promise<CardDoc | undefined> {
    const card = await ListingManager.getCard(tx, listingId);
    if (!card) return undefined;
    const next: CardDoc = {
      ...card,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await ListingManager.setCard(tx, listingId, next);
    return next;
  }

  /** Same as `patchCard` but for the detail doc. */
  static async patchDetail(
    tx: WriteTransaction,
    listingId: string,
    patch: Partial<ListingDoc>,
  ): Promise<ListingDoc | undefined> {
    const detail = await ListingManager.getDetail(tx, listingId);
    if (!detail) return undefined;
    const next: ListingDoc = {
      ...detail,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await ListingManager.setDetail(tx, listingId, next);
    return next;
  }
}
