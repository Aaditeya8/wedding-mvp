import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, type TravelInfo } from "@/db/schema";
import { THEMES } from "@/themes/catalog";

/* Everything the couple can change about their own site. Pure DB logic —
   the server actions in app/couple/site wrap these with requireRole. */

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hm = z.string().regex(/^\d{2}:\d{2}$/);
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const detailsSchema = z.object({
  brideName: z.string().trim().min(1).max(60),
  groomName: z.string().trim().min(1).max(60),
  weddingDate: ymd,
  city: optional(80),
  heroTagline: optional(160),
  story: optional(2000),
  brideParents: optional(160),
  groomParents: optional(160),
  hashtag: optional(60).transform((v) => (v ? v.replace(/^#+/, "") : v)),
  contactPhone: optional(40),
  theme: z.enum(THEMES).optional(),
});

export const rsvpSettingsSchema = z.object({
  rsvpOpen: z.boolean(),
  rsvpDeadline: z.union([ymd, z.literal("")]).optional(),
});

export const eventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  date: ymd,
  time: hm,
  venueName: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(240),
  mapUrl: z.union([z.string().trim().url().max(500), z.literal("")]).optional().transform((v) => v || null),
  dressCode: optional(80),
  description: optional(400),
  isPublished: z.boolean().default(true),
});

export const travelSchema = z.object({
  stays: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(400),
    url: z.union([z.string().trim().url().max(500), z.literal("")]).optional(),
  })).max(8),
  gettingThere: z.string().trim().max(1200),
});

export const istDate = (date: string, time = "10:00") => new Date(`${date}T${time}:00+05:30`);

/** Split a stored timestamp back into the editor's IST date + time fields. */
export function istParts(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour").replace("24", "00")}:${get("minute")}` };
}

type Result = { ok: true } | { ok: false; error: string };

export async function updateDetails(weddingId: string, input: unknown): Promise<Result> {
  const p = detailsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid input" };
  const { weddingDate, theme, ...rest } = p.data;
  await db.update(weddings).set({ ...rest, ...(theme && { theme }), weddingDate: istDate(weddingDate) }).where(eq(weddings.id, weddingId));
  return { ok: true };
}

export async function updateRsvpSettings(weddingId: string, input: unknown): Promise<Result> {
  const p = rsvpSettingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid input" };
  await db.update(weddings).set({
    rsvpOpen: p.data.rsvpOpen,
    rsvpDeadline: p.data.rsvpDeadline ? istDate(p.data.rsvpDeadline, "23:59") : null,
  }).where(eq(weddings.id, weddingId));
  return { ok: true };
}

export async function updateTravel(weddingId: string, input: unknown): Promise<Result> {
  const p = travelSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid input" };
  const travel: TravelInfo = {
    stays: p.data.stays.map((s) => ({ name: s.name, note: s.note, ...(s.url && { url: s.url }) })),
    gettingThere: p.data.gettingThere,
  };
  await db.update(weddings).set({ travel }).where(eq(weddings.id, weddingId));
  return { ok: true };
}

export async function upsertEvent(weddingId: string, input: unknown): Promise<Result & { id?: string }> {
  const p = eventSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid input" };
  const { id, date, time, ...rest } = p.data;
  const values = { ...rest, startsAt: istDate(date, time) };
  if (id) {
    const [row] = await db.update(events).set(values)
      .where(and(eq(events.id, id), eq(events.weddingId, weddingId))).returning();
    return row ? { ok: true, id: row.id } : { ok: false, error: "event not found" };
  }
  const existing = await db.select({ sortOrder: events.sortOrder }).from(events).where(eq(events.weddingId, weddingId));
  const sortOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;
  const [row] = await db.insert(events).values({ ...values, weddingId, sortOrder }).returning();
  return { ok: true, id: row.id };
}

export async function setEventPublished(weddingId: string, eventId: string, isPublished: boolean): Promise<Result> {
  const [row] = await db.update(events).set({ isPublished })
    .where(and(eq(events.id, eventId), eq(events.weddingId, weddingId))).returning();
  return row ? { ok: true } : { ok: false, error: "event not found" };
}

export async function deleteEvent(weddingId: string, eventId: string): Promise<Result> {
  const [row] = await db.delete(events)
    .where(and(eq(events.id, eventId), eq(events.weddingId, weddingId))).returning();
  return row ? { ok: true } : { ok: false, error: "event not found" };
}

/** Swap sort order with the neighbour; renumbers first so gaps never matter. */
export async function moveEvent(weddingId: string, eventId: string, dir: "up" | "down"): Promise<Result> {
  const rows = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder, events.startsAt);
  const i = rows.findIndex((r) => r.id === eventId);
  if (i < 0) return { ok: false, error: "event not found" };
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].sortOrder !== k) await db.update(events).set({ sortOrder: k }).where(eq(events.id, rows[k].id));
  }
  return { ok: true };
}

/** Sort events by their start time — one click after the couple has typed the dates in. */
export async function sortEventsByTime(weddingId: string): Promise<Result> {
  const rows = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.startsAt);
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].sortOrder !== k) await db.update(events).set({ sortOrder: k }).where(eq(events.id, rows[k].id));
  }
  return { ok: true };
}
