import { defineConfig } from "@playwright/test";

// PORT=3001 npm run e2e — when something else already owns :3000.
// global-setup seeds with the matching APP_URL so captured RSVP links agree.
const port = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    // Readiness must NOT touch the database: / redirects into /w/[slug],
    // and hammering a PGlite-backed route during first compile aborts the
    // instance. A static asset only answers once the server is truly up.
    url: `http://localhost:${port}/favicon.ico`,
    // On-disk PGlite allows ONE process: globalSetup seeds before this server
    // starts, so never reuse a dev server that already holds the data dir.
    reuseExistingServer: false,
    env: { EMAIL_MODE: "file" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
