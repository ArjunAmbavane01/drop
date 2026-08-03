import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/server/auth";

const authHandler = toNextJsHandler((request) => getAuth().handler(request));

export const GET = authHandler.GET!;
export const POST = authHandler.POST!;
