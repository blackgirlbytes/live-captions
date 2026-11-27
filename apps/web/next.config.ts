import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@heard/shared"],
  poweredByHeader: false,
};

export default nextConfig;
