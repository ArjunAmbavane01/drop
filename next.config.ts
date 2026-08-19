import type { NextConfig } from "next";
import { env } from "./lib/env";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: (() => {
      try {
        const url = new URL(env.r2PublicBaseUrl);
        return [
          {
            protocol: (url.protocol.replace(":", "") === "http" ? "http" : "https") as "http" | "https",
            hostname: url.hostname,
            port: url.port || undefined,
            pathname: url.pathname === "/" ? "/**" : `${url.pathname}/**`,
          },
        ];
      } catch {
        return [];
      }
    })(),
  },
  allowedDevOrigins: ['192.168.1.7'],
};

export default nextConfig;
