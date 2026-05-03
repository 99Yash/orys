import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { STORE_PATH } from "./config";

export type BotAccount = {
  index: number;
  email: string;
  password: string;
  name: string;
  userId: string;
};

export type Store = {
  bots: BotAccount[];
  listingIds: string[];
};

const empty: Store = { bots: [], listingIds: [] };

export async function loadStore(): Promise<Store> {
  if (!existsSync(STORE_PATH)) return { ...empty };
  const raw = await readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      bots: parsed.bots ?? [],
      listingIds: parsed.listingIds ?? [],
    };
  } catch {
    return { ...empty };
  }
}

export async function saveStore(store: Store): Promise<void> {
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");
}
