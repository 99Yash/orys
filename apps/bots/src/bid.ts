/**
 * Run M bidder bots against a listing for a fixed duration.
 *
 *   bun run apps/bots/src/bid.ts --listing <id>
 *   bun run apps/bots/src/bid.ts --listing <id> --bots 4 --duration 60
 *
 * If --listing is omitted, the last listing in .bots.json is used.
 *
 * Bots use the bot accounts seeded by `bun run bots:seed`. The listing
 * owner is automatically excluded from the bidder pool (no self-bidding).
 */

import { Bot } from "./lib/bot";
import { readCard, type CardSnapshot } from "./lib/listing";
import { loadStore, type BotAccount } from "./lib/store";

type Args = {
  listingId: string | undefined;
  bots: number | undefined;
  durationSec: number;
  minDelayMs: number;
  maxDelayMs: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    listingId: undefined,
    bots: undefined,
    durationSec: 60,
    minDelayMs: 500,
    maxDelayMs: 3000,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--listing") a.listingId = argv[++i];
    else if (k === "--bots") a.bots = Number(argv[++i]);
    else if (k === "--duration") a.durationSec = Number(argv[++i]);
    else if (k === "--min-delay") a.minDelayMs = Number(argv[++i]);
    else if (k === "--max-delay") a.maxDelayMs = Number(argv[++i]);
  }
  return a;
}

function fmt(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickCeiling(): number {
  // Per-bot ceiling between $50 and $500
  return Math.round(rand(5_000, 50_000));
}

async function runBidder(opts: {
  account: BotAccount;
  listingId: string;
  ceilingCents: number;
  endAt: number;
  minDelayMs: number;
  maxDelayMs: number;
  state: { bestCents: number; minStepCents: number; ended: boolean };
  stats: { bids: number; rejects: number; capped: number };
}): Promise<void> {
  const { account, listingId, endAt, state, stats } = opts;
  const bot = new Bot(account);
  await bot.signIn();

  let myLastBid = 0;

  while (Date.now() < endAt && !state.ended) {
    const wait = rand(opts.minDelayMs, opts.maxDelayMs);
    await new Promise((r) => setTimeout(r, wait));

    if (state.ended) break;

    const floor = state.bestCents + state.minStepCents;
    const bump = Math.round(rand(0, state.minStepCents * 2));
    const next = Math.max(myLastBid + state.minStepCents, floor + bump);

    if (next > opts.ceilingCents) {
      stats.capped++;
      console.log(
        `  [bot ${account.index}] passed (next ${fmt(next)} > ceiling ${fmt(opts.ceilingCents)})`,
      );
      // Wait it out for the rest of the run
      await new Promise((r) => setTimeout(r, opts.maxDelayMs));
      continue;
    }

    const quoteId = crypto.randomUUID();
    try {
      const res = await bot.push("quoteUpsert", {
        listingId,
        quoteId,
        amountCents: next,
      });

      if (res.success) {
        myLastBid = next;
        if (next > state.bestCents) state.bestCents = next;
        stats.bids++;
        console.log(`  [bot ${account.index}] bid ${fmt(next)}`);
      } else {
        stats.rejects++;
        const code = res.errors[0]?.code ?? "UNKNOWN";
        console.log(`  [bot ${account.index}] rejected: ${code}`);
        if (code === "INVALID_STATE" || code === "EXPIRED") {
          state.ended = true;
        }
      }
    } catch (err) {
      stats.rejects++;
      console.log(
        `  [bot ${account.index}] push error: ${(err as Error).message}`,
      );
    }
  }
}

async function watchListing(
  listingId: string,
  state: { bestCents: number; minStepCents: number; ended: boolean },
  endAt: number,
): Promise<void> {
  while (Date.now() < endAt && !state.ended) {
    try {
      const card = await readCard(listingId);
      if (!card) {
        state.ended = true;
        break;
      }
      if (card.bestAmountCents > state.bestCents) {
        state.bestCents = card.bestAmountCents;
      }
      state.minStepCents = card.minStepCents;
      if (card.status !== "LIVE") {
        state.ended = true;
        break;
      }
    } catch {
      // ignore transient pull errors
    }
    await new Promise((r) => setTimeout(r, 1500));
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

  const card: CardSnapshot | undefined = await readCard(listingId);
  if (!card) throw new Error(`listing ${listingId} not visible from pull`);
  if (card.status !== "LIVE") {
    throw new Error(`listing ${listingId} is ${card.status}, not LIVE`);
  }

  const eligible = store.bots.filter((b) => b.userId !== card.ownerId);
  if (eligible.length === 0) {
    throw new Error("no eligible bot bidders (every bot owns this listing?)");
  }
  const bidderCount = Math.min(args.bots ?? eligible.length, eligible.length);
  const bidders = eligible.slice(0, bidderCount);

  const endAt = Date.now() + args.durationSec * 1000;
  const state = {
    bestCents: card.bestAmountCents,
    minStepCents: card.minStepCents,
    ended: false,
  };
  const stats = { bids: 0, rejects: 0, capped: 0 };

  console.log(
    `\nListing ${listingId}\n` +
      `  status      : ${card.status}\n` +
      `  current best: ${fmt(card.bestAmountCents, card.currency)}\n` +
      `  min step    : ${fmt(card.minStepCents, card.currency)}\n` +
      `  ends at     : ${new Date(card.endsAt).toLocaleString()}\n` +
      `  duration    : ${args.durationSec}s\n` +
      `  bidders     : ${bidderCount} of ${store.bots.length} bot accounts\n`,
  );

  const stop = () => {
    state.ended = true;
    console.log("\nshutting down...");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const watcher = watchListing(listingId, state, endAt);
  await Promise.all(
    bidders.map((b) =>
      runBidder({
        account: b,
        listingId,
        ceilingCents: pickCeiling(),
        endAt,
        minDelayMs: args.minDelayMs,
        maxDelayMs: args.maxDelayMs,
        state,
        stats,
      }),
    ),
  );
  state.ended = true;
  await watcher;

  // Final read so the printed summary reflects post-run state
  const final = await readCard(listingId).catch(() => undefined);

  console.log(
    `\n— summary —\n` +
      `  successful bids : ${stats.bids}\n` +
      `  rejected bids   : ${stats.rejects}\n` +
      `  passed (ceiling): ${stats.capped}\n` +
      `  final best      : ${
        final ? fmt(final.bestAmountCents, final.currency) : "?"
      }\n` +
      `  final status    : ${final?.status ?? "?"}\n` +
      `  quote count     : ${final?.quoteCount ?? "?"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
