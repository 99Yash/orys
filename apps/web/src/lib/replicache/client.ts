"use client";

import { Replicache } from "replicache";
import { env } from "@orys/env/client";
import { auctionMutators } from "../auction/mutators";

let repInstance: Replicache | null = null;
let currentName: string | null = null;

/**
 * Get or create a Replicache instance.
 * Pass userId for authenticated users, or null for anonymous browsing.
 */
export function getReplicache(userId: string | null): Replicache {
  const name = userId ?? "anon";

  // If user changed (login/logout), close old instance
  if (repInstance && currentName !== name) {
    void repInstance.close();
    repInstance = null;
  }

  if (repInstance) return repInstance;

  const serverUrl = env.NEXT_PUBLIC_SERVER_URL;

  const rep = new Replicache({
    name,
    mutators: auctionMutators,
    schemaVersion: "1",
    pushURL: `${serverUrl}/api/replicache/push`,
    pullURL: `${serverUrl}/api/replicache/pull`,
    pullInterval: 30_000,
  });

  repInstance = rep;
  currentName = name;
  return rep;
}

export function closeReplicache() {
  if (repInstance) {
    void repInstance.close();
    repInstance = null;
    currentName = null;
  }
}
