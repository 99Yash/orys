import { SERVER_URL } from "./config";
import type { BotAccount } from "./store";

type MutationError = {
  name: string;
  code: string;
  message: string;
};

type PushResponse = {
  success: boolean;
  errors: MutationError[];
};

type AuthResponse = {
  user?: { id: string; email: string; name: string };
};

/**
 * Bot is a single authenticated HTTP client that can sign up / sign in
 * against Better Auth and push Replicache mutations directly to the server.
 *
 * It maintains its own clientGroupID + clientID + lastMutationId so each
 * run looks like a fresh Replicache client to the server.
 */
export class Bot {
  readonly account: BotAccount;
  private cookies = new Map<string, string>();
  private clientGroupID = crypto.randomUUID();

  constructor(account: BotAccount) {
    this.account = account;
  }

  // --- Auth ----------------------------------------------------------------

  /** Sign up a new account. Returns the resolved userId. */
  static async signUp(args: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ userId: string; bot: Bot }> {
    const bot = new Bot({
      index: -1,
      email: args.email,
      password: args.password,
      name: args.name,
      userId: "",
    });

    const res = await bot.fetch("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`sign-up failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as AuthResponse;
    if (!data.user?.id) {
      throw new Error(`sign-up returned no user id: ${JSON.stringify(data)}`);
    }
    bot.account.userId = data.user.id;
    return { userId: data.user.id, bot };
  }

  async signIn(): Promise<void> {
    const res = await this.fetch("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: this.account.email,
        password: this.account.password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`sign-in failed (${res.status}): ${text}`);
    }
  }

  // --- Replicache push -----------------------------------------------------

  async push(name: string, args: Record<string, unknown>): Promise<PushResponse> {
    // Fresh clientID per push: each request looks like a brand-new Replicache
    // client to the server, so a failure on one push never leaves the bot's
    // cursor out of sync with the server's view.
    const clientID = crypto.randomUUID();

    const res = await this.fetch("/api/replicache/push", {
      method: "POST",
      body: JSON.stringify({
        profileID: `bot-${this.account.index}`,
        clientGroupID: this.clientGroupID,
        mutations: [{ id: 1, clientID, name, args }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`push ${name} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as PushResponse;
  }

  // --- HTTP / cookie jar ---------------------------------------------------

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.cookies.size > 0) {
      headers.set("Cookie", this.cookieHeader());
    }

    const res = await fetch(SERVER_URL + path, { ...init, headers });

    // Capture Set-Cookie. Bun's fetch exposes them via getSetCookie().
    const setCookies =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie ===
      "function"
        ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
        : [];

    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || value === "deleted") {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }

    return res;
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}
