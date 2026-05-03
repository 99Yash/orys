/**
 * IndexedDB key constructors for Replicache document families.
 *
 * Single source of truth for the keyspace, used by:
 *   - server pull builder (`packages/api/src/replicache/pull.ts`)
 *   - client mutators + managers (`apps/web/src/lib/auction/*`)
 *   - bot harness (`apps/bots/src/lib/listing.ts`)
 *
 * Pattern (matches replicache-cvr's `IDB_KEY` shape): named-arg form, default
 * empty string for missing fields. Calling with no args yields the prefix
 * key, suitable for `tx.scan({ prefix })`.
 *
 *   IDB_KEY.CARD({ listingId: "abc" })  // "card/abc"
 *   IDB_KEY.CARD()                       // "card/"
 *
 * `filter((p) => p !== undefined)` (not `filter(Boolean)`) preserves the
 * trailing empty segment so prefix scans get the trailing slash.
 */

function constructKey(parts: (string | undefined)[]): string {
  return parts.filter((p) => p !== undefined).join("/");
}

export const IDB_KEY = {
  CARD: ({ listingId = "" }: { listingId?: string } = {}) =>
    constructKey(["card", listingId]),
  LISTING: ({ listingId = "" }: { listingId?: string } = {}) =>
    constructKey(["listing", listingId]),
  LEADERBOARD: ({
    listingId = "",
    rank = "",
  }: { listingId?: string; rank?: string } = {}) =>
    constructKey(["leaderboard", listingId, rank]),
  MY_QUOTE: ({ listingId = "" }: { listingId?: string } = {}) =>
    constructKey(["my-quote", listingId]),
  PRIVATE_QUOTE: ({
    listingId = "",
    quoteId = "",
  }: { listingId?: string; quoteId?: string } = {}) =>
    constructKey(["private-quote", listingId, quoteId]),
} as const;

export type IDBKeyName = keyof typeof IDB_KEY;
