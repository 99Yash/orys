import { auth } from "@orys/auth";
import { Elysia } from "elysia";
import { pushRequestSchema, pullRequestSchema } from "./replicache/schema";
import { handlePush } from "./replicache/push";
import { handlePull } from "./replicache/pull";
import { emitPokes } from "./replicache/events";
import { getSessionCached } from "./middleware/session-cache";

export const app = new Elysia({ prefix: "/api" })
  .all("/auth/*", async ({ request, set }) => {
    if (["POST", "GET"].includes(request.method)) {
      return auth().handler(request);
    }
    set.status = 405;
    return "Method Not Allowed";
  })
  .get("/health", () => ({ status: "ok" }))

  // Pull is public — anonymous users see public listings, authed users see their quotes too
  .post("/replicache/pull", async ({ request, set }) => {
    const session = await getSessionCached(request);
    const userId = session?.user?.id ?? null;

    const body = pullRequestSchema.safeParse(await request.json());
    if (!body.success) {
      set.status = 400;
      return { error: "Invalid pull request", details: body.error.issues };
    }

    return handlePull(body.data, userId);
  })

  // Push requires auth — only signed-in users can create/bid/etc.
  .post("/replicache/push", async ({ request, set }) => {
    const session = await getSessionCached(request);
    if (!session?.user) {
      set.status = 401;
      return { error: "Sign in to perform this action" };
    }

    const body = pushRequestSchema.safeParse(await request.json());
    if (!body.success) {
      set.status = 400;
      return { error: "Invalid push request", details: body.error.issues };
    }

    const result = await handlePush(body.data, session.user.id);
    emitPokes(session.user.id, result.affectedListingIds);

    return {
      success: result.errors.length === 0,
      errors: result.errors,
    };
  });

export type App = typeof app;
