"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Replicache } from "replicache";
import { getReplicache, closeReplicache } from "./client";
import type { AuctionMutators } from "../auction/mutators";
import * as ws from "../realtime/socket";

type Rep = Replicache<AuctionMutators>;

const ReplicacheContext = createContext<Rep | null>(null);

export function useRep(): Rep | null {
  return useContext(ReplicacheContext);
}

/**
 * Provides Replicache to the tree.
 * Pass userId for authenticated users, or null for anonymous browsing.
 */
export function ReplicacheProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [rep, setRep] = useState<Rep | null>(null);

  useEffect(() => {
    const r = getReplicache(userId) as Rep;
    setRep(r);

    ws.connect();

    const unsub = ws.onMessage((msg) => {
      if (msg.type === "poke") {
        void r.pull();
      }
    });

    return () => {
      unsub();
      ws.disconnect();
      closeReplicache();
      setRep(null);
    };
  }, [userId]);

  return (
    <ReplicacheContext.Provider value={rep}>
      {children}
    </ReplicacheContext.Provider>
  );
}
