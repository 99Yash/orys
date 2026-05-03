export const SERVER_URL =
  process.env.BOTS_SERVER_URL ?? "http://localhost:3001";

export const STORE_PATH =
  process.env.BOTS_STORE_PATH ??
  new URL("../../.bots.json", import.meta.url).pathname;

export const BOT_PASSWORD = "bot-password-1234";
