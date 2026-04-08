import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { app } from "@orys/api";
import { env } from "@orys/env/server";
import { Elysia } from "elysia";
import { wsPlugin } from "./realtime/ws";

const server = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .use(app)
  .use(wsPlugin)
  .listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
  });

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  await server.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
