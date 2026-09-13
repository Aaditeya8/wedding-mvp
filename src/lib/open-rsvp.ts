import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { rateLimit } from "@/lib/ratelimit";
import { normalizePhone } from "@/lib/slug";
import { DIET_OPTIONS } from "@/lib/presets";

/** The wedding as guests see it: only published events, in order. */
export async function getPublicWedding(slug: string) {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.slug, slug));
  if (!wedding) return null;
  const evs = await db.select().from(events)
    .where(and(eq(events.weddingId, wedding.id), eq(events.isPublished, true)))
    .orderBy(events.sortOrder);
  return { wedding, events: evs };
}

export function rsvpWindow(w: { rsvpOpen: boolean; rsvpDeadline: Date | null; weddingDate: Date }, now = new Date()) {
  if (!w.rsvpOpen) return { open: false as const, reason: "closed" as const };
  if (w.rsvpDeadline && w.rsvpDeadline.getTime() < now.getTime()) return { open: false as const, reason: "deadline" as const };
  if (w.weddingDate.getTime() + 86_400_000 < now.getTime()) return { open: false as const, reason: "past" as const };
  return { open: true as const };
}

export const MAX_OPEN_HEADCOUNT = 10;

const schema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("")),
  side: z.enum(["bride", "groom", "both"]).optional(),
  diet: z.enum(DIET_OPTIONS.map((d) => d.value) as [string, ...string[]]).optional(),
  guestNames: z.array(z.string().trim().min(1).max(120)).max(MAX_OPEN_HEADCOUNT).optional(),
  note: z.string().trim().max(500).optional(),
  responses: z.array(z.object({
    eventId: z.string().uuid(),
    status: z.enum(["attending", "declined"]),
    headcount: z.number().int().min(0).max(MAX_OPEN_HEADCOUNT),
  })).min(1).max(30),
});

export type OpenRsvpInput = z.input<typeof schema>;
export type OpenRsvpResult =
  /** `editPath` is origin-relative on purpose: the guest is already on the right
      host, so the link they are handed never depends on APP_URL being correct. */
  | { ok: true; editPath: string; familyName: string; attending: string[] }
  | { ok: false; error: string };

/**
 * RSVP from the shareable invitation link — no token, no account. The guest
 * becomes (or is matched to) a household in the same tables the committee uses,
 * so every dashboard already understands them. Matching is by email, then
 * phone, within this wedding only; a returning guest updates rather than
 * duplicates. They get an edit link (a normal invite token) in return.
 */
export async function submitOpenRsvp(input: unknown, clientKey = "local"): Promise<OpenRsvpResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const d = parsed.data;
  const email = d.email || null;
  const phone = normalizePhone(d.phone);
  if (!email && !phone) return { ok: false, error: "phone or email required" };
  if (!rateLimit(`open-rsvp:${clientKey}`, { max: 10 })) return { ok: false, error: "too many requests" };

  const data = await getPublicWedding(d.slug);
  if (!data) return { ok: false, error: "wedding not found" };
  const { wedding, events: published } = data;
  if (!rsvpWindow(wedding).open) return { ok: false, error: "rsvp closed" };

  const publishedIds = new Set(published.map((e) => e.id));
  for (const r of d.responses) {
    if (!publishedIds.has(r.eventId)) return { ok: false, error: "unknown event" };
    if (r.status === "attending" && r.headcount < 1) return { ok: false, error: "headcount out of range" };
  }

  // find the household: same email, else same phone, in this wedding
  const candidates = await db.select().from(families).where(eq(families.weddingId, wedding.id));
  let family = (email && candidates.find((f) => f.email.trim().toLowerCase() === email))
    || (phone && candidates.find((f) => normalizePhone(f.phone) === phone))
    || null;

  if (family) {
    await db.update(families).set({
      email: family.email.trim() ? family.email : (email ?? ""),
      phone: family.phone ?? phone,
      diet: d.diet ?? family.diet,
      side: family.side ?? d.side ?? "both",
    }).where(eq(families.id, family.id));
  } else {
    [family] = await db.insert(families).values({
      weddingId: wedding.id, name: d.name, side: d.side ?? "both", relation: "RSVP'd via invitation link",
      email: email ?? "", phone, diet: d.diet ?? null, source: "guest",
    }).returning();
  }

  // members: the names they gave, else the household name itself
  const existingMembers = await db.select().from(guests).where(eq(guests.familyId, family.id));
  if (existingMembers.length === 0) {
    const names = (d.guestNames?.filter(Boolean).length ? d.guestNames! : [d.name]);
    await db.insert(guests).values(names.map((fullName) => ({ familyId: family!.id, fullName })));
  }

  const responded = d.responses.map((r) => r.eventId);
  await db.insert(eventInvites)
    .values(responded.map((eventId) => ({ eventId, familyId: family!.id })))
    .onConflictDoNothing();

  for (const r of d.responses) {
    const headcount = r.status === "declined" ? 0 : r.headcount;
    await db.insert(rsvps)
      .values({ eventId: r.eventId, familyId: family.id, status: r.status, headcount, note: d.note || null })
      .onConflictDoUpdate({
        target: [rsvps.eventId, rsvps.familyId],
        set: { status: r.status, headcount, note: d.note || null, respondedAt: new Date() },
      });
  }

  // an edit link: only mint a fresh token when it won't invalidate an emailed one
  let editPath = "";
  if (family.source === "guest" || !family.inviteTokenHash) {
    const { token, tokenHash } = generateInviteToken();
    await db.update(families).set({ inviteTokenHash: tokenHash, tokenExpiresAt: tokenExpiry(wedding.weddingDate) })
      .where(eq(families.id, family.id));
    editPath = `/rsvp/${token}`;
  }

  const attendingIds = d.responses.filter((r) => r.status === "attending").map((r) => r.eventId);
  const attending = attendingIds.length
    ? (await db.select({ name: events.name }).from(events).where(inArray(events.id, attendingIds)).orderBy(events.sortOrder)).map((e) => e.name)
    : [];
  return { ok: true, editPath, familyName: family.name, attending };
}
