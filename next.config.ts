import type { NextConfig } from "next";
import { env } from "./lib/env";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: env.r2PublicBaseUrl,
      },
    ],
  },
};

export default nextConfig;
