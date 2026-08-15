import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    // Readiness must NOT touch the database: / redirects into /w/[slug],
    // and hammering a PGlite-backed route during first compile aborts the
    // instance. A static asset only answers once the server is truly up.
    url: "http://localhost:3000/favicon.ico",
    // On-disk PGlite allows ONE process: globalSetup seeds before this server
    // starts, so never reuse a dev server that already holds the data dir.
    reuseExistingServer: false,
    env: { EMAIL_MODE: "file" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
