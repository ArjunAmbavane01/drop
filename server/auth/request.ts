import { headers } from "next/headers";

import { getAuth } from "@/server/auth";

export async function requireRequestSession() {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}
