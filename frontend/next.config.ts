import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Without an explicit root, Turbopack walks past this folder looking for a
    // lockfile and can resolve from a parent directory instead.
    root: __dirname,
  },
};

export default nextConfig;
