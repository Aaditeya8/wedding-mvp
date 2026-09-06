import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM assets that must load from node_modules, not the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Guest-list uploads + the parsed sheet round-tripping through the import wizard
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
