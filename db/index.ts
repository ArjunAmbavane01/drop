import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "@/db/schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const sql = neon(env.databaseUrl);
    dbInstance = drizzle(sql, { schema });
  }

  return dbInstance;
}

export type Database = ReturnType<typeof getDb>;
