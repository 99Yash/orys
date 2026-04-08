"use client";

import { useState, useEffect, useRef } from "react";
import * as ws from "../../lib/realtime/socket";

export function PresenceCount({ listingId }: { listingId: string }) {
  const [count, setCount] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const channel = `presence:listing:${listingId}`;

  useEffect(() => {
    ws.joinPresence(channel);

    const unsub = ws.onMessage((msg) => {
      if (msg.type === "presence:count" && msg.channel === channel) {
        setCount(msg.count ?? 0);
      }
    });

    heartbeatRef.current = setInterval(() => {
      ws.heartbeatPresence(channel);
    }, 15_000);

    return () => {
      ws.leavePresence(channel);
      unsub();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [channel]);

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
      </span>
      {count} watching
    </span>
  );
}
