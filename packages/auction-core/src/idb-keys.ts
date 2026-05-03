/**
 * IndexedDB key constructors for Replicache document families.
 *
 * Single source of truth for the keyspace, used by:
 *   - server pull builder (`packages/api/src/replicache/pull.ts`)
 *   - client mutators + managers (`apps/web/src/lib/auction/*`)
 *   - bot harness (`apps/bots/src/lib/listing.ts`)
 *
 * Pattern (matches replicache-cvr's `IDB_KEY` shape): named-arg form, default
 * empty string for missing fields.
 *
 *   IDB_KEY.CARD({ listingId: "abc" })             // "card/abc"
 *   IDB_KEY.LEADERBOARD({ listingId: "abc" })       // "leaderboard/abc/"
 *   IDB_KEY.PRIVATE_QUOTE({ listingId: "abc" })     // "private-quote/abc/"
 *
 * For prefix scans (`tx.scan({ prefix })`), pass the highest-level segments
 * you want to fix. Omitting trailing segments yields the right prefix with
 * a trailing slash. Do NOT call with no args for multi-segment families —
 * `LEADERBOARD()` gives `"leaderboard//"`, which won't match real keys.
 *
 * `filter((p) => p !== undefined)` (not `filter(Boolean)`) preserves an
 * empty trailing segment so a single missing field still yields a slash.
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
