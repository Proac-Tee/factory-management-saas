import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The label studio is the app for now.
  async redirects() {
    return [{ source: "/", destination: "/labels", permanent: false }];
  },
  experimental: {
    agentFeedback: true,
  },
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
