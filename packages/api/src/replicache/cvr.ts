/**
 * Client View Record (CVR) — lightweight snapshot of {id -> rowVersion} maps.
 * Used to compute minimal diffs between pulls.
 */

export type ClientViewMetadata = { rowVersion: number };
export type ClientViewMap = Map<string, ClientViewMetadata>;

export type SearchResult = { id: string; rowVersion: number };

export interface CVRSnapshot {
  clients: ClientViewMap;
  listings: ClientViewMap;
  quotes: ClientViewMap;
}

export function serializeSearchResult(
  results: SearchResult[],
): ClientViewMap {
  const map = new Map<string, ClientViewMetadata>();
  for (const row of results) {
    map.set(row.id, { rowVersion: row.rowVersion });
  }
  return map;
}

export function generateCVR(meta: {
  clientsMeta: SearchResult[];
  listingsMeta: SearchResult[];
  quotesMeta: SearchResult[];
}): CVRSnapshot {
  return {
    clients: serializeSearchResult(meta.clientsMeta),
    listings: serializeSearchResult(meta.listingsMeta),
    quotes: serializeSearchResult(meta.quotesMeta),
  };
}

/** IDs present in next but absent/older in prev → need PUT */
export function getPutsSince(
  next: ClientViewMap,
  prev: ClientViewMap,
): string[] {
  const puts: string[] = [];
  for (const [id, meta] of next) {
    const prevMeta = prev.get(id);
    if (!prevMeta || prevMeta.rowVersion < meta.rowVersion) {
      puts.push(id);
    }
  }
  return puts;
}

/** IDs in prev but absent from next → need DEL */
export function getDelsSince(
  next: ClientViewMap,
  prev: ClientViewMap,
): string[] {
  const dels: string[] = [];
  for (const [id] of prev) {
    if (!next.has(id)) {
      dels.push(id);
    }
  }
  return dels;
}

export const emptyCVR: CVRSnapshot = {
  clients: new Map(),
  listings: new Map(),
  quotes: new Map(),
};
