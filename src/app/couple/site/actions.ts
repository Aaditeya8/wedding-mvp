"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import * as editor from "@/lib/editor";
import { EVENT_PRESETS, presetStart } from "@/lib/presets";

/* Every action re-resolves the wedding server-side: a couple is pinned to
   their own; admin passes one explicitly. Then the site + editor revalidate
   and we bounce back to the section that was saved. */
async function scoped(formData: FormData) {
  const staff = await requireRole(["couple", "admin"]);
  const weddingId = staff.role === "admin" ? String(formData.get("weddingId") ?? "") : staff.weddingId;
  if (!weddingId) redirect("/couple");
  const [w] = await db.select({ slug: weddings.slug, weddingDate: weddings.weddingDate }).from(weddings).where(eq(weddings.id, weddingId));
  if (!w) redirect("/couple");
  return { weddingId, slug: w.slug, weddingDate: w.weddingDate, admin: staff.role === "admin" };
}

function done(ctx: { slug: string; weddingId: string; admin: boolean }, section: string, error?: string) {
  revalidatePath(`/w/${ctx.slug}`);
  revalidatePath(`/w/${ctx.slug}/rsvp`);
  revalidatePath("/couple");
  revalidatePath("/couple/site");
  const q = new URLSearchParams(error ? { error, section } : { saved: section });
  if (ctx.admin) q.set("wedding", ctx.weddingId);
  redirect(`/couple/site?${q}#${section}`);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function saveDetails(formData: FormData) {
  const ctx = await scoped(formData);
  const r = await editor.updateDetails(ctx.weddingId, {
    brideName: str(formData, "brideName"), groomName: str(formData, "groomName"),
    weddingDate: str(formData, "weddingDate"), city: str(formData, "city"),
    heroTagline: str(formData, "heroTagline"), story: str(formData, "story"),
    brideParents: str(formData, "brideParents"), groomParents: str(formData, "groomParents"),
    hashtag: str(formData, "hashtag"), contactPhone: str(formData, "contactPhone"),
  });
  done(ctx, "details", r.ok ? undefined : r.error);
}

export async function saveRsvpSettings(formData: FormData) {
  const ctx = await scoped(formData);
  const r = await editor.updateRsvpSettings(ctx.weddingId, {
    rsvpOpen: formData.get("rsvpOpen") === "on", rsvpDeadline: str(formData, "rsvpDeadline"),
  });
  done(ctx, "rsvp", r.ok ? undefined : r.error);
}

export async function saveTravel(formData: FormData) {
  const ctx = await scoped(formData);
  const stays = [];
  for (let i = 0; i < 6; i++) {
    const name = str(formData, `stay${i}name`).trim();
    if (name) stays.push({ name, note: str(formData, `stay${i}note`), url: str(formData, `stay${i}url`) });
  }
  const r = await editor.updateTravel(ctx.weddingId, { stays, gettingThere: str(formData, "gettingThere") });
  done(ctx, "travel", r.ok ? undefined : r.error);
}

export async function saveEvent(formData: FormData) {
  const ctx = await scoped(formData);
  const id = str(formData, "id") || undefined;
  const r = await editor.upsertEvent(ctx.weddingId, {
    id, name: str(formData, "name"), date: str(formData, "date"), time: str(formData, "time"),
    venueName: str(formData, "venueName"), address: str(formData, "address"), mapUrl: str(formData, "mapUrl"),
    dressCode: str(formData, "dressCode"), description: str(formData, "description"),
    isPublished: formData.get("isPublished") === "on",
  });
  done(ctx, id ? `event-${id}` : "events", r.ok ? undefined : r.error);
}

export async function addPresetEvent(formData: FormData) {
  const ctx = await scoped(formData);
  const preset = EVENT_PRESETS.find((p) => p.name === str(formData, "preset"));
  const startsAt = preset ? presetStart(preset, ctx.weddingDate) : ctx.weddingDate;
  const parts = editor.istParts(startsAt);
  const r = await editor.upsertEvent(ctx.weddingId, {
    name: preset?.name ?? "New celebration", date: parts.date, time: parts.time,
    venueName: "Venue to be announced", address: "To be announced",
    dressCode: preset?.dressCode ?? "", description: preset?.blurb ?? "", isPublished: true,
  });
  done(ctx, r.ok && r.id ? `event-${r.id}` : "events", r.ok ? undefined : r.error);
}

export async function toggleEvent(formData: FormData) {
  const ctx = await scoped(formData);
  const id = str(formData, "id");
  const r = await editor.setEventPublished(ctx.weddingId, id, formData.get("isPublished") === "true");
  done(ctx, `event-${id}`, r.ok ? undefined : r.error);
}

export async function removeEvent(formData: FormData) {
  const ctx = await scoped(formData);
  const r = await editor.deleteEvent(ctx.weddingId, str(formData, "id"));
  done(ctx, "events", r.ok ? undefined : r.error);
}

export async function moveEventAction(formData: FormData) {
  const ctx = await scoped(formData);
  const id = str(formData, "id");
  const r = await editor.moveEvent(ctx.weddingId, id, str(formData, "dir") === "up" ? "up" : "down");
  done(ctx, `event-${id}`, r.ok ? undefined : r.error);
}

export async function sortEvents(formData: FormData) {
  const ctx = await scoped(formData);
  await editor.sortEventsByTime(ctx.weddingId);
  done(ctx, "events");
}
