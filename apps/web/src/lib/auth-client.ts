"use client";

import { createAuthClient } from "better-auth/react";
import { env } from "@orys/env/client";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
});

export type Session = ReturnType<typeof authClient.useSession>["data"];
