/**
 * WebSocket handler for poke + presence channels.
 * Mounted on the Elysia server (not inside @orys/api).
 */

import { Elysia } from "elysia";
import { subscribe } from "@orys/api/replicache/events";

/** In-memory presence store */
const presenceStore = new Map<
  string, // channel
  Map<string, number> // socketId -> lastHeartbeat timestamp
>();

const PRESENCE_TTL_MS = 45_000;
const PRESENCE_EMIT_INTERVAL_MS = 3_000;

type WSData = {
  subscriptions: (() => void)[];
  socketId: string;
  presenceChannels: Set<string>;
};

function getPresenceCount(channel: string): number {
  const viewers = presenceStore.get(channel);
  if (!viewers) return 0;
  const now = Date.now();
  let count = 0;
  for (const [id, ts] of viewers) {
    if (now - ts < PRESENCE_TTL_MS) {
      count++;
    } else {
      viewers.delete(id);
    }
  }
  return count;
}

// Periodically clean up stale presence entries
setInterval(() => {
  const now = Date.now();
  for (const [channel, viewers] of presenceStore) {
    for (const [id, ts] of viewers) {
      if (now - ts >= PRESENCE_TTL_MS) viewers.delete(id);
    }
    if (viewers.size === 0) presenceStore.delete(channel);
  }
}, PRESENCE_TTL_MS);

export const wsPlugin = new Elysia()
  .ws("/ws", {
    open(ws) {
      const data: WSData = {
        subscriptions: [],
        socketId: crypto.randomUUID(),
        presenceChannels: new Set(),
      };
      (ws.data as unknown as { wsData: WSData }).wsData = data;
    },

    message(ws, raw) {
      const data = (ws.data as unknown as { wsData: WSData }).wsData;
      const msg = raw as { type: string; channel?: string };

      if (msg.type === "subscribe" && msg.channel) {
        // Subscribe to poke channel
        const unsub = subscribe(msg.channel, () => {
          ws.send(JSON.stringify({ type: "poke", channel: msg.channel }));
        });
        data.subscriptions.push(unsub);
        ws.send(
          JSON.stringify({ type: "subscribed", channel: msg.channel }),
        );
      }

      if (msg.type === "presence:join" && msg.channel) {
        let viewers = presenceStore.get(msg.channel);
        if (!viewers) {
          viewers = new Map();
          presenceStore.set(msg.channel, viewers);
        }
        viewers.set(data.socketId, Date.now());
        data.presenceChannels.add(msg.channel);
        ws.send(
          JSON.stringify({
            type: "presence:count",
            channel: msg.channel,
            count: getPresenceCount(msg.channel),
          }),
        );
      }

      if (msg.type === "presence:heartbeat" && msg.channel) {
        const viewers = presenceStore.get(msg.channel);
        if (viewers) {
          viewers.set(data.socketId, Date.now());
        }
        ws.send(
          JSON.stringify({
            type: "presence:count",
            channel: msg.channel,
            count: getPresenceCount(msg.channel),
          }),
        );
      }

      if (msg.type === "presence:leave" && msg.channel) {
        const viewers = presenceStore.get(msg.channel);
        if (viewers) viewers.delete(data.socketId);
        data.presenceChannels.delete(msg.channel);
      }
    },

    close(ws) {
      const data = (ws.data as unknown as { wsData?: WSData }).wsData;
      if (!data) return;

      // Clean up poke subscriptions
      for (const unsub of data.subscriptions) unsub();

      // Clean up presence
      for (const channel of data.presenceChannels) {
        const viewers = presenceStore.get(channel);
        if (viewers) viewers.delete(data.socketId);
      }
    },
  });

// Broadcast presence counts periodically to all viewers
setInterval(() => {
  // This is handled on-demand via heartbeat responses
  // For a more active push, you'd iterate ws connections here
}, PRESENCE_EMIT_INTERVAL_MS);
