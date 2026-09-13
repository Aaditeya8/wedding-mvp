import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, rsvps, guests } from "@/db/schema";
import { getPublicWedding, submitOpenRsvp, rsvpWindow } from "@/lib/open-rsvp";
import { getFamilyByToken } from "@/lib/rsvp";

let weddingId: string, sangeet: string, pheras: string, hidden: string;

beforeAll(async () => {
  await migrateDb();
  const [w] = await db.insert(weddings).values({
    slug: "open1", brideName: "A", groomName: "B", theme: "raj-mahal", weddingDate: new Date("2030-11-20"),
  }).returning();
  weddingId = w.id;
  const rows = await db.insert(events).values([
    { weddingId, name: "Sangeet", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 },
    { weddingId, name: "Pheras", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 1 },
    { weddingId, name: "Secret afterparty", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 2, isPublished: false },
  ]).returning();
  [sangeet, pheras, hidden] = rows.map((r) => r.id);
});

describe("getPublicWedding", () => {
  it("hides unpublished events", async () => {
    const d = await getPublicWedding("open1");
    expect(d?.events.map((e) => e.name)).toEqual(["Sangeet", "Pheras"]);
  });
});

describe("rsvpWindow", () => {
  const base = { rsvpOpen: true, rsvpDeadline: null, weddingDate: new Date("2030-11-20") };
  it("open by default", () => expect(rsvpWindow(base).open).toBe(true));
  it("closed when toggled off", () => expect(rsvpWindow({ ...base, rsvpOpen: false })).toMatchObject({ open: false, reason: "closed" }));
  it("closed after deadline", () => expect(rsvpWindow({ ...base, rsvpDeadline: new Date("2020-01-01") })).toMatchObject({ open: false, reason: "deadline" }));
  it("closed after the wedding", () => expect(rsvpWindow({ ...base, weddingDate: new Date("2020-01-01") })).toMatchObject({ open: false, reason: "past" }));
});

describe("submitOpenRsvp", () => {
  const base = { slug: "open1", name: "The Raos", phone: "+91 98765 43210", diet: "veg" };

  it("needs a phone or email", async () => {
    const r = await submitOpenRsvp({ slug: "open1", name: "Nobody", responses: [{ eventId: sangeet, status: "attending", headcount: 1 }] });
    expect(r).toEqual({ ok: false, error: "phone or email required" });
  });
  it("rejects hidden events", async () => {
    const r = await submitOpenRsvp({ ...base, responses: [{ eventId: hidden, status: "attending", headcount: 1 }] });
    expect(r).toEqual({ ok: false, error: "unknown event" });
  });
  it("creates a guest-source household, invites, rsvps and an edit link", async () => {
    const r = await submitOpenRsvp({ ...base, guestNames: ["P Rao", "Q Rao"], responses: [
      { eventId: sangeet, status: "attending", headcount: 2 }, { eventId: pheras, status: "declined", headcount: 0 },
    ] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.attending).toEqual(["Sangeet"]);
    expect(r.editUrl).toMatch(/\/rsvp\/[A-Za-z0-9_-]{20,}/);
    const [fam] = await db.select().from(families).where(eq(families.weddingId, weddingId));
    expect(fam).toMatchObject({ name: "The Raos", source: "guest", phone: "9876543210", diet: "veg", email: "" });
    expect((await db.select().from(guests).where(eq(guests.familyId, fam.id))).length).toBe(2);
    const viaToken = await getFamilyByToken(r.editUrl.split("/rsvp/")[1]);
    expect(viaToken?.events.map((e) => e.name).sort()).toEqual(["Pheras", "Sangeet"]);
  });
  it("a returning guest (same phone, different formatting) updates instead of duplicating", async () => {
    const r = await submitOpenRsvp({ ...base, phone: "09876543210", email: "rao@example.com", responses: [
      { eventId: sangeet, status: "attending", headcount: 4 },
    ] });
    expect(r.ok).toBe(true);
    const fams = await db.select().from(families).where(eq(families.weddingId, weddingId));
    expect(fams.length).toBe(1);
    expect(fams[0].email).toBe("rao@example.com");
    const [row] = await db.select().from(rsvps).where(eq(rsvps.eventId, sangeet));
    expect(row.headcount).toBe(4);
  });
  it("matches by email too", async () => {
    const r = await submitOpenRsvp({ slug: "open1", name: "Rao again", email: "RAO@example.com", responses: [{ eventId: pheras, status: "attending", headcount: 1 }] });
    expect(r.ok).toBe(true);
    expect((await db.select().from(families).where(eq(families.weddingId, weddingId))).length).toBe(1);
  });
  it("refuses when the couple closes RSVP", async () => {
    await db.update(weddings).set({ rsvpOpen: false }).where(eq(weddings.id, weddingId));
    const r = await submitOpenRsvp({ ...base, responses: [{ eventId: sangeet, status: "attending", headcount: 1 }] });
    expect(r).toEqual({ ok: false, error: "rsvp closed" });
  });
});
