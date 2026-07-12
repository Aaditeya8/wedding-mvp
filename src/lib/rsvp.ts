import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps } from "@/db/schema";
import { hashToken, isExpired } from "@/lib/tokens";
import { rateLimit } from "@/lib/ratelimit";

export async function getFamilyByToken(token: string) {
  const [family] = await db.select().from(families)
    .where(eq(families.inviteTokenHash, hashToken(token)));
  if (!family || isExpired(family.tokenExpiresAt)) return null;

  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, family.weddingId));
  const members = await db.select().from(guests).where(eq(guests.familyId, family.id));
  const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, family.id));
  const eventIds = invites.map((i) => i.eventId);
  const evs = eventIds.length
    ? await db.select().from(events).where(inArray(events.id, eventIds)).orderBy(events.sortOrder)
    : [];
  const existing = await db.select().from(rsvps).where(eq(rsvps.familyId, family.id));

  return {
    family: { id: family.id, name: family.name, side: family.side, relation: family.relation },
    wedding: { id: wedding.id, slug: wedding.slug, brideName: wedding.brideName, groomName: wedding.groomName, theme: wedding.theme, weddingDate: wedding.weddingDate },
    members: members.map((m) => ({ id: m.id, fullName: m.fullName, ageGroup: m.ageGroup })),
    events: evs.map((e) => {
      const r = existing.find((x) => x.eventId === e.id);
      return { id: e.id, name: e.name, startsAt: e.startsAt, venueName: e.venueName, address: e.address, mapUrl: e.mapUrl, dressCode: e.dressCode,
        rsvp: r ? { status: r.status, headcount: r.headcount, note: r.note } : null };
    }),
  };
}

const submitSchema = z.object({
  token: z.string().min(20),
  responses: z.array(z.object({
    eventId: z.string().uuid(),
    status: z.enum(["attending", "declined"]),
    headcount: z.number().int().min(0).max(50),
    note: z.string().max(500).optional(),
  })).min(1),
});

export async function submitRsvp(input: unknown, clientKey = "local"):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { token, responses } = parsed.data;

  if (!rateLimit(`rsvp:${clientKey}`) || !rateLimit(`rsvp:tok:${token.slice(0, 12)}`))
    return { ok: false, error: "too many requests" };

  const fam = await getFamilyByToken(token);
  if (!fam) return { ok: false, error: "invalid token" };

  const invitedIds = new Set(fam.events.map((e) => e.id));
  const maxHeadcount = fam.members.length + 2;
  for (const r of responses) {
    if (!invitedIds.has(r.eventId)) return { ok: false, error: "not invited to event" };
    if (r.status === "attending" && (r.headcount < 1 || r.headcount > maxHeadcount))
      return { ok: false, error: "headcount out of range" };
  }

  for (const r of responses) {
    const headcount = r.status === "declined" ? 0 : r.headcount;
    await db.insert(rsvps)
      .values({ eventId: r.eventId, familyId: fam.family.id, status: r.status, headcount, note: r.note })
      .onConflictDoUpdate({
        target: [rsvps.eventId, rsvps.familyId],
        set: { status: r.status, headcount, note: r.note ?? null, respondedAt: new Date() },
      });
  }
  return { ok: true };
}

export async function getRsvpSummary(weddingId: string) {
  const evs = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
  const out = [];
  for (const e of evs) {
    const invited = await db.select({ n: sql<number>`count(*)::int` }).from(eventInvites).where(eq(eventInvites.eventId, e.id));
    const resp = await db.select({
      n: sql<number>`count(*)::int`,
      heads: sql<number>`coalesce(sum(case when status = 'attending' then headcount else 0 end), 0)::int`,
    }).from(rsvps).where(eq(rsvps.eventId, e.id));
    out.push({ eventId: e.id, eventName: e.name, invitedFamilies: invited[0].n, responded: resp[0].n, attendingHeadcount: resp[0].heads });
  }
  return out;
}
