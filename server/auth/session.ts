import { cache } from "react";
import { headers } from "next/headers";

import { getAuth } from "@/server/auth";

export const getCurrentSession = cache(async () => {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  return session;
});
