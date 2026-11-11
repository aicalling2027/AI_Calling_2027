import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Google accounts carry an avatar on lh3..lh6.googleusercontent.com; the
    // header renders it through next/image, so the host has to be allowed.
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  turbopack: {
    // Without an explicit root, Turbopack walks past this folder looking for a
    // lockfile and can resolve from a parent directory instead.
    root: __dirname,
  },
};

export default nextConfig;
