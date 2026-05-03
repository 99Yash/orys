/**
 * Seed bot users (and optionally a starter listing) for the demo.
 *
 *   bun run apps/bots/src/seed.ts                 # 5 bot users, no listing
 *   bun run apps/bots/src/seed.ts --count 8        # 8 bot users
 *   bun run apps/bots/src/seed.ts --listing        # also create+publish a listing owned by bot 0
 *   bun run apps/bots/src/seed.ts --reset          # ignore existing .bots.json and start fresh
 */

import { Bot } from "./lib/bot";
import { BOT_PASSWORD } from "./lib/config";
import { loadStore, saveStore, type BotAccount } from "./lib/store";

type Args = {
  count: number;
  listing: boolean;
  reset: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { count: 5, listing: false, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count") args.count = Number(argv[++i] ?? args.count);
    else if (a === "--listing") args.listing = true;
    else if (a === "--reset") args.reset = true;
  }
  return args;
}

function botEmail(suffix: string, index: number): string {
  return `bot-${suffix}-${index}@orys.local`;
}

async function ensureBots(targetCount: number, reset: boolean): Promise<BotAccount[]> {
  const store = reset ? { bots: [], listingIds: [] } : await loadStore();
  const existing = store.bots;

  if (existing.length >= targetCount) {
    console.log(`✓ ${existing.length} bot users already in store`);
    return existing.slice(0, targetCount);
  }

  // Use a fresh suffix per seed run so emails don't collide across resets.
  const suffix = Date.now().toString(36);

  for (let i = existing.length; i < targetCount; i++) {
    const email = botEmail(suffix, i);
    const name = `Bot ${i}`;
    process.stdout.write(`  signing up ${email} ... `);
    try {
      const { userId } = await Bot.signUp({
        email,
        password: BOT_PASSWORD,
        name,
      });
      const account: BotAccount = {
        index: i,
        email,
        password: BOT_PASSWORD,
        name,
        userId,
      };
      store.bots.push(account);
      await saveStore(store);
      console.log(`ok (${userId})`);
    } catch (err) {
      console.log(`FAIL`);
      throw err;
    }
    // Be polite to Better Auth's default rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  return store.bots;
}

async function createStarterListing(owner: BotAccount): Promise<string> {
  const bot = new Bot(owner);
  await bot.signIn();

  const listingId = crypto.randomUUID();
  const endsAtMs = Date.now() + 24 * 60 * 60 * 1000; // 24h

  console.log(`  bot ${owner.index} creating listing ${listingId} ...`);
  const create = await bot.push("listingCreate", {
    listingId,
    title: `Demo auction ${new Date().toLocaleString()}`,
    description: "Live demo listing seeded by apps/bots",
    endsAtMs,
    minStepCents: 100,
    currency: "USD",
  });
  if (!create.success) {
    throw new Error(`listingCreate failed: ${JSON.stringify(create.errors)}`);
  }

  console.log(`  bot ${owner.index} publishing listing ${listingId} ...`);
  const publish = await bot.push("listingPublish", { listingId });
  if (!publish.success) {
    throw new Error(`listingPublish failed: ${JSON.stringify(publish.errors)}`);
  }

  return listingId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `Seeding ${args.count} bot users${args.listing ? " + 1 listing" : ""}` +
      `${args.reset ? " (reset)" : ""}`,
  );

  const bots = await ensureBots(args.count, args.reset);

  if (args.listing) {
    const owner = bots[0];
    if (!owner) throw new Error("no bots to own the listing");
    const listingId = await createStarterListing(owner);

    const store = await loadStore();
    store.listingIds.push(listingId);
    await saveStore(store);

    console.log(`\n✓ listing ready: ${listingId}`);
    console.log(`  bid against it with: bun run bots:bid -- --listing ${listingId}`);
  } else {
    console.log(`\n✓ ${bots.length} bots ready`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
