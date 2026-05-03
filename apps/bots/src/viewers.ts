/**
 * Open M phantom viewers against a listing's presence channel.
 *
 *   bun run apps/bots/src/viewers.ts --listing <id>
 *   bun run apps/bots/src/viewers.ts --listing <id> --count 89 --duration 300
 *
 * Each viewer opens a WebSocket, joins `presence:listing:<id>`, and
 * heartbeats every 15s. No DB writes — pure presence inflation.
 */

import { SERVER_URL } from "./lib/config";
import { loadStore } from "./lib/store";

type Args = {
  listingId: string | undefined;
  count: number;
  durationSec: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { listingId: undefined, count: 30, durationSec: 60 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--listing") a.listingId = argv[++i];
    else if (k === "--count") a.count = Number(argv[++i]);
    else if (k === "--duration") a.durationSec = Number(argv[++i]);
  }
  return a;
}

const HEARTBEAT_MS = 15_000;

function wsUrl(): string {
  return SERVER_URL.replace(/^http/, "ws") + "/ws";
}

type Viewer = {
  ws: WebSocket;
  heartbeat: ReturnType<typeof setInterval> | undefined;
  closed: boolean;
};

function openViewer(channel: string, lastCount: { value: number }): Viewer {
  const ws = new WebSocket(wsUrl());
  const v: Viewer = { ws, heartbeat: undefined, closed: false };

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "presence:join", channel }));
    v.heartbeat = setInterval(() => {
      if (v.closed || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "presence:heartbeat", channel }));
    }, HEARTBEAT_MS);
  });

  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data as string) as {
        type?: string;
        count?: number;
      };
      if (msg.type === "presence:count" && typeof msg.count === "number") {
        lastCount.value = msg.count;
      }
    } catch {
      // ignore non-JSON
    }
  });

  ws.addEventListener("close", () => {
    v.closed = true;
    if (v.heartbeat) clearInterval(v.heartbeat);
  });

  ws.addEventListener("error", () => {
    v.closed = true;
    if (v.heartbeat) clearInterval(v.heartbeat);
  });

  return v;
}

function closeViewer(v: Viewer, channel: string): void {
  if (v.closed) return;
  v.closed = true;
  if (v.heartbeat) clearInterval(v.heartbeat);
  try {
    if (v.ws.readyState === WebSocket.OPEN) {
      v.ws.send(JSON.stringify({ type: "presence:leave", channel }));
    }
    v.ws.close();
  } catch {
    // ignore
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = await loadStore();

  const listingId = args.listingId ?? store.listingIds.at(-1);
  if (!listingId) {
    throw new Error(
      "no --listing given and none in .bots.json; run `bun run bots:seed -- --listing` first",
    );
  }

  const channel = `presence:listing:${listingId}`;
  const lastCount = { value: 0 };
  const viewers: Viewer[] = [];

  console.log(
    `\nOpening ${args.count} viewers on ${channel} for ${args.durationSec}s\n`,
  );

  // Stagger opens so we get a visible ramp instead of a thundering herd
  for (let i = 0; i < args.count; i++) {
    viewers.push(openViewer(channel, lastCount));
    await new Promise((r) => setTimeout(r, 30));
  }

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log("\nclosing viewers...");
    for (const v of viewers) closeViewer(v, channel);
    setTimeout(() => process.exit(0), 200);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const reporter = setInterval(() => {
    console.log(`  ${lastCount.value} viewing now`);
  }, 2_000);

  await new Promise((r) => setTimeout(r, args.durationSec * 1000));

  clearInterval(reporter);
  for (const v of viewers) closeViewer(v, channel);
  console.log(`\n✓ closed ${viewers.length} viewers (last count: ${lastCount.value})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
