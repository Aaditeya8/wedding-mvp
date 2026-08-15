import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { weddings } from "@/db/schema";
import { THEMES, type Theme } from "@/themes/catalog";

const theme = process.argv[2] as Theme;
const slug = process.argv[3] ?? "ananya-weds-arjun";
if (!THEMES.includes(theme)) {
  console.error(`usage: tsx scripts/set-theme.ts <${THEMES.join("|")}> [wedding-slug]`);
  process.exit(1);
}

async function run() {
  const res = await db.update(weddings).set({ theme }).where(eq(weddings.slug, slug)).returning();
  console.log(res.length ? `${slug}: theme -> ${theme}` : `no wedding with slug "${slug}"`);
  await closeDb();
}

void run();
