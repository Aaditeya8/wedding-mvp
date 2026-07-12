import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings } from "@/db/schema";

const theme = process.argv[2] as "ivory-editorial" | "raj-mahal" | "gulaab-rococo";
if (!["ivory-editorial", "raj-mahal", "gulaab-rococo"].includes(theme)) {
  console.error("usage: tsx scripts/set-theme.ts <ivory-editorial|raj-mahal|gulaab-rococo>");
  process.exit(1);
}

db.update(weddings)
  .set({ theme })
  .where(eq(weddings.slug, "ananya-weds-arjun"))
  .then(() => { console.log(`theme -> ${theme}`); process.exit(0); });
