"use client";

import { useEffect, useState } from "react";
import { useRep } from "./provider";
import type { ReadonlyJSONValue, ReadTransaction } from "replicache";

/**
 * Subscribe to a Replicache query. Re-renders on changes.
 */
export function useSubscribe<T>(
  query: (tx: ReadTransaction) => Promise<T>,
  defaultValue: T,
  deps: unknown[] = [],
): T {
  const rep = useRep();
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (!rep) return;
    const unsub = rep.subscribe(query, {
      onData: setValue,
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, ...deps]);

  return value;
}

/** Get all entries matching a key prefix. */
export function useScan<T = ReadonlyJSONValue>(
  prefix: string,
  deps: unknown[] = [],
): T[] {
  return useSubscribe(
    async (tx) => {
      const entries: T[] = [];
      for await (const entry of tx.scan({ prefix }).values()) {
        entries.push(entry as T);
      }
      return entries;
    },
    [],
    [prefix, ...deps],
  );
}
