import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow react-three-fiber + drei to work without transpilation issues
  transpilePackages: ["three"],
};

export default nextConfig;
