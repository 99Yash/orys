export const SERVER_URL =
  process.env.BOTS_SERVER_URL ?? "http://localhost:3001";

export const STORE_PATH =
  process.env.BOTS_STORE_PATH ??
  new URL("../../.bots.json", import.meta.url).pathname;

const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(
  SERVER_URL,
);

const envPassword = process.env.BOT_PASSWORD;

if (!envPassword && !isLocalhost) {
  throw new Error(
    `BOT_PASSWORD env var must be set when BOTS_SERVER_URL is not localhost (got ${SERVER_URL}).`,
  );
}

export const BOT_PASSWORD = envPassword ?? "bot-password-1234";
