"use client";

import { env } from "@orys/env/client";

type MessageHandler = (msg: {
  type: string;
  channel?: string;
  count?: number;
}) => void;

let ws: WebSocket | null = null;
let handlers = new Set<MessageHandler>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

function getWsUrl(): string {
  if (env.NEXT_PUBLIC_WS_URL) return env.NEXT_PUBLIC_WS_URL;
  // Derive from server URL
  const serverUrl = env.NEXT_PUBLIC_SERVER_URL;
  return serverUrl.replace(/^http/, "ws") + "/ws";
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
}

export function connect() {
  if (ws?.readyState === WebSocket.OPEN || isConnecting) return;
  isConnecting = true;

  const socket = new WebSocket(getWsUrl());

  socket.onopen = () => {
    ws = socket;
    isConnecting = false;
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      for (const handler of handlers) handler(msg);
    } catch {
      // ignore parse errors
    }
  };

  socket.onclose = () => {
    if (ws === socket) ws = null;
    isConnecting = false;
    scheduleReconnect();
  };

  socket.onerror = () => {
    socket.close();
  };
}

export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
}

export function send(msg: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function onMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function subscribeChannel(channel: string) {
  send({ type: "subscribe", channel });
}

export function joinPresence(channel: string) {
  send({ type: "presence:join", channel });
}

export function heartbeatPresence(channel: string) {
  send({ type: "presence:heartbeat", channel });
}

export function leavePresence(channel: string) {
  send({ type: "presence:leave", channel });
}
