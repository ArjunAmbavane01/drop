import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-1356c9f4a3714922b9c36242abf9a91b.r2.dev",
      },
    ],
  },
};

export default nextConfig;
