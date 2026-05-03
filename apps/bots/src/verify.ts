/**
 * Deterministic correctness check.
 *
 *   bun run apps/bots/src/verify.ts                       # 3 bidders × 2 rounds
 *   bun run apps/bots/src/verify.ts --bidders 4 --rounds 3
 *
 * Runs a known scenario against the live server:
 *   1. Bot 0 creates + publishes a fresh listing.
 *   2. Bots 1..N round-robin a fixed number of bids, each exactly best + step.
 *   3. Anonymous pull, assert final card matches expectations.
 *
 * Exits 0 on PASS, 1 on FAIL — wires straight into CI.
 */

import { Bot } from "./lib/bot";
import { readCard } from "./lib/listing";
import { loadStore, type BotAccount } from "./lib/store";

type Args = {
  bidders: number;
  rounds: number;
  startCents: number;
  stepCents: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    bidders: 3,
    rounds: 2,
    startCents: 1000,
    stepCents: 100,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--bidders") a.bidders = Number(argv[++i]);
    else if (k === "--rounds") a.rounds = Number(argv[++i]);
    else if (k === "--start") a.startCents = Number(argv[++i]);
    else if (k === "--step") a.stepCents = Number(argv[++i]);
  }
  return a;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function setupListing(owner: BotAccount, stepCents: number): Promise<string> {
  const bot = new Bot(owner);
  await bot.signIn();

  const listingId = crypto.randomUUID();
  const create = await bot.push("listingCreate", {
    listingId,
    title: `Verify run ${new Date().toISOString()}`,
    description: "Deterministic verify scenario",
    // 1h end keeps us clear of the 3-minute anti-snipe window
    endsAtMs: Date.now() + 60 * 60 * 1000,
    minStepCents: stepCents,
    currency: "USD",
  });
  if (!create.success) {
    throw new Error(`listingCreate failed: ${JSON.stringify(create.errors)}`);
  }

  const publish = await bot.push("listingPublish", { listingId });
  if (!publish.success) {
    throw new Error(`listingPublish failed: ${JSON.stringify(publish.errors)}`);
  }
  return listingId;
}

type RunResult = {
  listingId: string;
  expected: { quoteCount: number; bestAmountCents: number };
  bidsAttempted: number;
  bidsSucceeded: number;
  failures: { bot: number; bid: number; code: string; message: string }[];
};

async function runScenario(args: Args, accounts: BotAccount[]): Promise<RunResult> {
  const owner = accounts[0]!;
  const bidders = accounts.slice(1, 1 + args.bidders);

  const listingId = await setupListing(owner, args.stepCents);
  console.log(`  listing ${listingId} created + published\n`);

  const bots: Bot[] = [];
  for (const acc of bidders) {
    const b = new Bot(acc);
    await b.signIn();
    bots.push(b);
  }

  const failures: RunResult["failures"] = [];
  const totalBids = args.bidders * args.rounds;
  let succeeded = 0;
  let amount = args.startCents;

  for (let r = 0; r < args.rounds; r++) {
    for (let i = 0; i < args.bidders; i++) {
      const bot = bots[i]!;
      const acc = bidders[i]!;
      const quoteId = crypto.randomUUID();
      const res = await bot.push("quoteUpsert", {
        listingId,
        quoteId,
        amountCents: amount,
      });
      if (res.success) {
        succeeded++;
        console.log(`  round ${r + 1} bot ${acc.index} bid ${fmt(amount)} ✓`);
      } else {
        const e = res.errors[0];
        failures.push({
          bot: acc.index,
          bid: amount,
          code: e?.code ?? "UNKNOWN",
          message: e?.message ?? "",
        });
        console.log(
          `  round ${r + 1} bot ${acc.index} bid ${fmt(amount)} ✗ ${e?.code}`,
        );
      }
      amount += args.stepCents;
    }
  }

  const expected = {
    quoteCount: args.bidders, // one ACTIVE quote per bidder (upsert)
    bestAmountCents: args.startCents + args.stepCents * (totalBids - 1),
  };

  return {
    listingId,
    expected,
    bidsAttempted: totalBids,
    bidsSucceeded: succeeded,
    failures,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = await loadStore();
  const need = args.bidders + 1;
  if (store.bots.length < need) {
    throw new Error(
      `need ≥${need} seeded bots (1 owner + ${args.bidders} bidders), have ${store.bots.length}. ` +
        `run \`bun run bots:seed -- --count ${need}\``,
    );
  }

  console.log(
    `\nVerify scenario: ${args.bidders} bidders × ${args.rounds} rounds, ` +
      `start ${fmt(args.startCents)}, step ${fmt(args.stepCents)}\n`,
  );

  const result = await runScenario(args, store.bots);

  // Allow a moment for any post-push poke fan-out / row-version commit
  await new Promise((r) => setTimeout(r, 200));
  const card = await readCard(result.listingId);
  if (!card) {
    console.error(`\n✗ FAIL: listing ${result.listingId} not visible from pull`);
    process.exit(1);
  }

  const checks = [
    {
      name: "all bids accepted",
      ok: result.bidsSucceeded === result.bidsAttempted,
      got: `${result.bidsSucceeded} / ${result.bidsAttempted}`,
      want: `${result.bidsAttempted} / ${result.bidsAttempted}`,
    },
    {
      name: "card.bestAmountCents",
      ok: card.bestAmountCents === result.expected.bestAmountCents,
      got: fmt(card.bestAmountCents),
      want: fmt(result.expected.bestAmountCents),
    },
    {
      name: "card.quoteCount",
      ok: card.quoteCount === result.expected.quoteCount,
      got: String(card.quoteCount),
      want: String(result.expected.quoteCount),
    },
    {
      name: "card.status",
      ok: card.status === "LIVE",
      got: card.status,
      want: "LIVE",
    },
  ];

  console.log(`\n— results —`);
  let allOk = true;
  for (const c of checks) {
    const tag = c.ok ? "✓" : "✗";
    if (!c.ok) allOk = false;
    console.log(
      `  ${tag} ${c.name.padEnd(24)} got=${c.got.padEnd(10)} want=${c.want}`,
    );
  }
  if (result.failures.length > 0) {
    console.log(`\n  push failures:`);
    for (const f of result.failures) {
      console.log(
        `    bot ${f.bot} @ ${fmt(f.bid)} → ${f.code}: ${f.message}`,
      );
    }
  }

  if (allOk) {
    console.log(`\n✓ PASS  listing=${result.listingId}`);
    process.exit(0);
  } else {
    console.log(`\n✗ FAIL  listing=${result.listingId}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
