import { db, closeDb } from "@/db/client";
import { outbox, weddings } from "@/db/schema";
import { desc } from "drizzle-orm";
async function main() {
  const rows = await db.select().from(outbox).orderBy(desc(outbox.at)).limit(5);
  console.log("outbox rows (should NOT contain the new signup if SMTP worked):", rows.length);
  for (const r of rows) console.log("  ", r.kind, r.to, r.at.toISOString());
  const ws = await db.select({ slug: weddings.slug }).from(weddings);
  console.log("weddings:", ws.map((w) => w.slug).join(", "));
  await closeDb();
}
main();
