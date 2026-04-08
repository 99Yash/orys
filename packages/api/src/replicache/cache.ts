/**
 * In-memory CVR cache. Swap for Redis adapter in production.
 */

import type { CVRSnapshot, ClientViewMap, ClientViewMetadata } from "./cvr";
import { emptyCVR } from "./cvr";
import type { PullCookie } from "./schema";

type SerializedCVR = {
  clients: [string, ClientViewMetadata][];
  listings: [string, ClientViewMetadata][];
  quotes: [string, ClientViewMetadata][];
};

function makeCVRKey(clientGroupID: string, order: number) {
  return `${clientGroupID}/${order}`;
}

function serializeMap(map: ClientViewMap): [string, ClientViewMetadata][] {
  return [...map];
}

function deserializeMap(
  arr: [string, ClientViewMetadata][],
): ClientViewMap {
  return new Map(arr);
}

function serializeCVR(cvr: CVRSnapshot): SerializedCVR {
  return {
    clients: serializeMap(cvr.clients),
    listings: serializeMap(cvr.listings),
    quotes: serializeMap(cvr.quotes),
  };
}

function deserializeCVR(data: SerializedCVR): CVRSnapshot {
  return {
    clients: deserializeMap(data.clients),
    listings: deserializeMap(data.listings),
    quotes: deserializeMap(data.quotes),
  };
}

/** Simple in-memory LRU-ish store with TTL */
const store = new Map<string, { data: SerializedCVR; expiresAt: number }>();
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_ENTRIES = 10_000;

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
  // if still over, drop oldest
  if (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
}

export function getBaseCVR(
  clientGroupID: string,
  cookie: PullCookie,
): { baseCVR: CVRSnapshot; previousCVR: CVRSnapshot | undefined } {
  let previousCVR: CVRSnapshot | undefined;

  if (cookie && typeof cookie.order === "number") {
    const key = makeCVRKey(clientGroupID, cookie.order);
    const entry = store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      previousCVR = deserializeCVR(entry.data);
    }
  }

  return {
    baseCVR: previousCVR ?? emptyCVR,
    previousCVR,
  };
}

export function setCVR(
  clientGroupID: string,
  order: number,
  cvr: CVRSnapshot,
) {
  evict();
  const key = makeCVRKey(clientGroupID, order);
  store.set(key, {
    data: serializeCVR(cvr),
    expiresAt: Date.now() + TTL_MS,
  });
}

export function delCVR(clientGroupID: string, order: number) {
  store.delete(makeCVRKey(clientGroupID, order));
}
