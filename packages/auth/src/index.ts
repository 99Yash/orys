import { db } from "@orys/db";
import * as schema from "@orys/db/schema/auth";
import { env } from "@orys/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

type Auth = ReturnType<typeof betterAuth>;

let _auth: Auth | undefined;

export function auth(): Auth {
  if (_auth) return _auth;

  _auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!user.name) {
              const prefix = user.email?.split("@")[0] ?? "User";
              return { data: { ...user, name: prefix } };
            }
          },
        },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
  });

  return _auth;
}
