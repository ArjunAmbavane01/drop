import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/db";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

function createAuth() {
  return betterAuth({
    appName: "Drop",
    secret: env.betterAuthSecret,
    baseURL: env.betterAuthUrl,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    plugins: [nextCookies()],
  });
}

type AppAuth = ReturnType<typeof createAuth>;

let authInstance: AppAuth | undefined;

export function getAuth(): AppAuth {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance!;
}
