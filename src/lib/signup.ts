import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, users } from "@/db/schema";
import { slugify, uniqueSlug } from "@/lib/slug";
import { starterEvents } from "@/lib/presets";
import { THEMES } from "@/themes/catalog";

export const signupSchema = z.object({
  brideName: z.string().trim().min(1).max(60),
  groomName: z.string().trim().min(1).max(60),
  weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  city: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  theme: z.enum(THEMES).optional(),
});
export type SignupInput = z.input<typeof signupSchema>;

export type SignupResult =
  | { ok: true; created: true; slug: string; weddingId: string; email: string }
  | { ok: true; created: false; email: string }
  | { ok: false; error: string };

/**
 * Self-serve: one form creates the wedding, five starter events around the date,
 * and the couple's login. An email that already has a login is simply signed in
 * again — never a second wedding. The caller sends the magic link.
 */
export async function createWeddingForCouple(input: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const d = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, d.email));
  if (existing) return { ok: true, created: false, email: d.email };

  const weddingDate = new Date(`${d.weddingDate}T10:00:00+05:30`);
  if (Number.isNaN(weddingDate.getTime())) return { ok: false, error: "invalid input" };

  const slug = await uniqueSlug(slugify(d.brideName, "weds", d.groomName), async (s) =>
    (await db.select({ id: weddings.id }).from(weddings).where(eq(weddings.slug, s))).length > 0);

  const [w] = await db.insert(weddings).values({
    slug, brideName: d.brideName, groomName: d.groomName, weddingDate, city: d.city,
    theme: d.theme ?? "ivory-editorial",
    heroTagline: "Two families, one big yes.",
  }).returning();
  await db.insert(events).values(starterEvents(weddingDate, d.city).map((e) => ({ ...e, weddingId: w.id })));
  await db.insert(users).values({ email: d.email, name: `${d.brideName} & ${d.groomName}`, role: "couple", weddingId: w.id });
  return { ok: true, created: true, slug, weddingId: w.id, email: d.email };
}
