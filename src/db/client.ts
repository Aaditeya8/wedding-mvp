import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

function makeDb() {
  if (url) return drizzleNeon(neon(url), { schema });
  // Embedded Postgres for local dev/tests. On-disk PGlite supports only ONE
  // process at a time: tests and `next build` workers use throwaway in-memory
  // instances so they never contend with (or corrupt) the dev server's data dir.
  const ephemeral = process.env.VITEST || process.env.NEXT_PHASE === "phase-production-build";
  const pglite = new PGlite(ephemeral ? undefined : "var/pglite");
  return drizzlePglite(pglite, { schema });
}

// Survive Next.js hot reload without piling up connections
const g = globalThis as unknown as { __db?: ReturnType<typeof makeDb> };
export const db = (g.__db ??= makeDb());

export async function migrateDb() {
  const { migrate } = url
    ? await import("drizzle-orm/neon-http/migrator")
    : await import("drizzle-orm/pglite/migrator");
  // Both migrators share this call signature
  await (migrate as any)(db, { migrationsFolder: "drizzle" });
}
