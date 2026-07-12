import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM assets that must load from node_modules, not the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
