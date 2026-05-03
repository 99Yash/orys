/**
 * Shared auction business rules.
 *
 * Pure validation functions with NO DB / framework imports — usable from both
 * the server (`service.ts`) and the browser client (`apps/web` mutators).
 *
 * Each `check*` function throws `AuctionError` on violation. Callers pass in
 * lightweight snapshots of the relevant rows. The server reads them from
 * Postgres; the client reads them from Replicache local state.
 */

export type ListingStatus = "DRAFT" | "LIVE" | "ENDED" | "AWARDED";
export type QuoteStatus = "ACTIVE" | "WITHDRAWN" | "AWARDED";

export type ListingSnapshot = {
  ownerId: string;
  status: ListingStatus;
  endsAtMs: number;
  minStepCents: number;
};

export type QuoteSnapshot = {
  listingId: string;
  userId: string;
  status: QuoteStatus;
};

export class AuctionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuctionError";
  }
}

export function isExpired(
  listing: { endsAtMs: number },
  nowMs: number = Date.now(),
): boolean {
  return listing.endsAtMs < nowMs;
}

export function checkListingPublish(opts: {
  listing: Pick<ListingSnapshot, "ownerId" | "status"> | null;
  userId: string;
}): void {
  const { listing, userId } = opts;
  if (!listing) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (listing.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can publish");
  if (listing.status !== "DRAFT")
    throw new AuctionError(
      "INVALID_STATE",
      `Cannot publish from ${listing.status}`,
    );
}

export function checkQuoteUpsert(opts: {
  listing: ListingSnapshot | null;
  /** Highest ACTIVE quote amount on the listing that does not belong to the bidder. 0 if none. */
  bestOtherCents: number;
  userId: string;
  amountCents: number;
  nowMs?: number;
}): void {
  const {
    listing,
    bestOtherCents,
    userId,
    amountCents,
    nowMs = Date.now(),
  } = opts;
  if (!listing) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (listing.status !== "LIVE")
    throw new AuctionError("INVALID_STATE", "Listing is not live");
  if (listing.endsAtMs < nowMs)
    throw new AuctionError("EXPIRED", "Listing has expired");
  if (listing.ownerId === userId)
    throw new AuctionError("SELF_BID", "Cannot bid on own listing");
  if (amountCents <= 0)
    throw new AuctionError("BID_TOO_LOW", "Bid must be positive");
  if (bestOtherCents > 0) {
    const minRequired = bestOtherCents + listing.minStepCents;
    if (amountCents < minRequired) {
      throw new AuctionError(
        "BID_TOO_LOW",
        `Bid must be at least ${minRequired} cents`,
      );
    }
  }
}

export function checkQuoteWithdraw(opts: {
  quote: Pick<QuoteSnapshot, "userId" | "status"> | null;
  userId: string;
}): void {
  const { quote, userId } = opts;
  if (!quote) throw new AuctionError("NOT_FOUND", "Quote not found");
  if (quote.userId !== userId)
    throw new AuctionError("FORBIDDEN", "Not your quote");
  if (quote.status !== "ACTIVE")
    throw new AuctionError("INVALID_STATE", "Quote is not active");
}

export function checkListingEndNow(opts: {
  listing: Pick<ListingSnapshot, "ownerId" | "status"> | null;
  userId: string;
}): void {
  const { listing, userId } = opts;
  if (!listing) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (listing.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can end");
  if (listing.status !== "LIVE")
    throw new AuctionError(
      "INVALID_STATE",
      `Cannot end from ${listing.status}`,
    );
}

export function checkListingAward(opts: {
  listing: Pick<ListingSnapshot, "ownerId" | "status"> | null;
  quote: Pick<QuoteSnapshot, "listingId" | "status"> | null;
  listingId: string;
  userId: string;
}): void {
  const { listing, quote, listingId, userId } = opts;
  if (!listing) throw new AuctionError("NOT_FOUND", "Listing not found");
  if (listing.ownerId !== userId)
    throw new AuctionError("FORBIDDEN", "Only owner can award");
  if (listing.status !== "ENDED")
    throw new AuctionError(
      "INVALID_STATE",
      `Cannot award from ${listing.status}`,
    );
  if (!quote) throw new AuctionError("NOT_FOUND", "Quote not found");
  if (quote.listingId !== listingId)
    throw new AuctionError("INVALID_STATE", "Quote is for different listing");
  if (quote.status !== "ACTIVE")
    throw new AuctionError("INVALID_STATE", "Quote is not active");
}
