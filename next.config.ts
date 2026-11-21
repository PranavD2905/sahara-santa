import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a native binary, so it must not be bundled.
  serverExternalPackages: ["sharp"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
