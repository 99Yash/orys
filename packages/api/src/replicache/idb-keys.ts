/**
 * IndexedDB key constructors for Replicache document families.
 */

function join(...parts: string[]) {
  return parts.filter(Boolean).join("/");
}

export const IDB = {
  card: (listingId = "") => join("card", listingId),
  listing: (listingId = "") => join("listing", listingId),
  leaderboard: (listingId = "", rank = "") =>
    join("leaderboard", listingId, rank),
  myQuote: (listingId = "") => join("my-quote", listingId),
  privateQuote: (listingId = "", quoteId = "") =>
    join("private-quote", listingId, quoteId),
} as const;
