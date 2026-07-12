import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events } from "@/db/schema";

export async function getWeddingBySlug(slug: string) {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.slug, slug));
  if (!wedding) return null;
  const evs = await db.select().from(events)
    .where(eq(events.weddingId, wedding.id)).orderBy(events.sortOrder);
  return { wedding, events: evs };
}
