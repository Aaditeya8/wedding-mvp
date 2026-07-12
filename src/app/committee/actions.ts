"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { families, guests, eventInvites, events } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { issueInvites } from "@/lib/invites";

/* Admin may act on any wedding (passes it explicitly); committee is pinned
   to their own. Every action re-resolves this server-side — never trust input. */
async function scopedWeddingId(requested: string): Promise<string | null> {
  const staff = await requireRole(["committee", "admin"]);
  if (staff.role === "admin") return requested;
  return staff.weddingId;
}

const familySchema = z.object({
  weddingId: z.string().uuid(),
  familyId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  side: z.enum(["bride", "groom", "both"]),
  relation: z.string().max(120).optional(),
  email: z.string().email().max(254),
  members: z.array(z.object({
    fullName: z.string().min(1).max(120),
    ageGroup: z.enum(["adult", "child"]),
  })).min(1).max(20),
  eventIds: z.array(z.string().uuid()).max(50),
});

export async function upsertFamily(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = familySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const weddingId = await scopedWeddingId(parsed.data.weddingId);
  if (!weddingId) return { ok: false, error: "forbidden" };
  const { name, side, relation, email, members, eventIds } = parsed.data;

  const validEvents = new Set(
    (await db.select().from(events).where(eq(events.weddingId, weddingId))).map((e) => e.id),
  );
  if (!eventIds.every((id) => validEvents.has(id))) return { ok: false, error: "invalid events" };

  let familyId = parsed.data.familyId;
  if (familyId) {
    const [fam] = await db.select().from(families)
      .where(and(eq(families.id, familyId), eq(families.weddingId, weddingId)));
    if (!fam) return { ok: false, error: "family not found" };
    await db.update(families).set({ name, side, relation: relation ?? null, email })
      .where(eq(families.id, familyId));
    await db.delete(guests).where(eq(guests.familyId, familyId));
    await db.delete(eventInvites).where(eq(eventInvites.familyId, familyId));
  } else {
    const [f] = await db.insert(families)
      .values({ weddingId, name, side, relation: relation ?? null, email }).returning();
    familyId = f.id;
  }

  await db.insert(guests).values(members.map((m) => ({ familyId: familyId!, ...m })));
  if (eventIds.length) {
    await db.insert(eventInvites).values(eventIds.map((eventId) => ({ eventId, familyId: familyId! })));
  }
  revalidatePath("/committee");
  return { ok: true };
}

const sendSchema = z.object({
  weddingId: z.string().uuid(),
  familyIds: z.array(z.string().uuid()).min(1).max(100),
  type: z.enum(["invite", "resend", "remind"]),
});

export async function sendInvitesAction(input: unknown) {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid input" };
  const weddingId = await scopedWeddingId(parsed.data.weddingId);
  if (!weddingId) return { ok: false as const, error: "forbidden" };
  const results = await issueInvites(weddingId, parsed.data.familyIds, parsed.data.type);
  revalidatePath("/committee");
  return { ok: true as const, results };
}
