import { IDB_KEY } from "@orys/auction-core";
import { SERVER_URL } from "./config";

export type CardSnapshot = {
  id: string;
  status: "DRAFT" | "LIVE" | "ENDED" | "AWARDED";
  bestAmountCents: number;
  quoteCount: number;
  endsAt: string;
  minStepCents: number;
  currency: string;
  ownerId: string;
};

type PatchOp =
  | { op: "clear" }
  | { op: "del"; key: string }
  | { op: "put"; key: string; value: Record<string, unknown> };

type PullResponse = {
  patch: PatchOp[];
};

/**
 * Anonymous pull. Returns a map of every visible listing keyed by id.
 * We pass cookie=null so the server emits a full clear+put dump every call.
 */
export async function readAllCards(): Promise<Map<string, CardSnapshot>> {
  const res = await fetch(`${SERVER_URL}/api/replicache/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileID: "bots-reader",
      clientGroupID: "bots-reader",
      cookie: null,
    }),
  });

  if (!res.ok) {
    throw new Error(`pull failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as PullResponse;
  const cards = new Map<string, CardSnapshot>();
  const cardPrefix = IDB_KEY.CARD();

  for (const op of data.patch) {
    if (op.op !== "put") continue;
    if (!op.key.startsWith(cardPrefix)) continue;
    const id = op.key.slice(cardPrefix.length);
    cards.set(id, op.value as unknown as CardSnapshot);
  }

  return cards;
}

export async function readCard(listingId: string): Promise<CardSnapshot | undefined> {
  const all = await readAllCards();
  return all.get(listingId);
}
