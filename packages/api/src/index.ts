import { auth } from "@orys/auth";
import { Elysia } from "elysia";

export const app = new Elysia({ prefix: "/api" })
  .all("/auth/*", async ({ request, set }) => {
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    set.status = 405;
    return "Method Not Allowed";
  })
  .get("/health", () => ({ status: "ok" }));

export type App = typeof app;
