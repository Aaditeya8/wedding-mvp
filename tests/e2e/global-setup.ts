import { execSync } from "node:child_process";
import fs from "node:fs";

// Seed before the web server boots — PGlite's data dir is single-process,
// so seeding must never run while the app holds it. RSVP URLs (with live
// tokens) are captured here for the specs to read.
export default function globalSetup() {
  // Hermetic: an unclean shutdown can leave the single-process PGlite dir
  // unrecoverable — every local state we need is recreated by the seed.
  fs.rmSync("var/pglite", { recursive: true, force: true });
  const port = process.env.PORT ?? "3000";
  const out = execSync("npx tsx --env-file=.env scripts/seed.ts", {
    encoding: "utf8",
    // --env-file loads APP_URL=…:3000 from .env; the process env must win so
    // the captured RSVP links point at the port this run actually serves on
    env: { ...process.env, APP_URL: `http://localhost:${port}` },
  });
  fs.mkdirSync("var", { recursive: true });
  fs.writeFileSync("var/e2e-seed.txt", out);
}
