import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@earshot/shared"],
  poweredByHeader: false,
};

export default nextConfig;
