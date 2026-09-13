import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "@/db/client";
import { weddings, events } from "@/db/schema";
import { updateDetails, updateRsvpSettings, updateTravel, upsertEvent, setEventPublished, deleteEvent, moveEvent, istParts, sortEventsByTime } from "@/lib/editor";
import { getPublicWedding } from "@/lib/open-rsvp";

let weddingId: string, other: string;
beforeAll(async () => {
  await migrateDb();
  const [w] = await db.insert(weddings).values({ slug: "ed1", brideName: "A", groomName: "B", weddingDate: new Date("2027-01-10T04:30:00Z") }).returning();
  const [o] = await db.insert(weddings).values({ slug: "ed2", brideName: "C", groomName: "D", weddingDate: new Date("2027-01-10T04:30:00Z") }).returning();
  weddingId = w.id; other = o.id;
});

describe("editor", () => {
  it("updates details incl. parents, hashtag (hash stripped), theme", async () => {
    const r = await updateDetails(weddingId, { brideName: "Ananya", groomName: "Arjun", weddingDate: "2027-02-01", city: "Pune", brideParents: "Sunita & Rajesh Sharma", groomParents: "", hashtag: "#AnanyaKaArjun", theme: "raj-mahal" });
    expect(r.ok).toBe(true);
    const [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
    expect(w).toMatchObject({ brideName: "Ananya", city: "Pune", brideParents: "Sunita & Rajesh Sharma", groomParents: null, hashtag: "AnanyaKaArjun", theme: "raj-mahal" });
    expect(istParts(w.weddingDate)).toEqual({ date: "2027-02-01", time: "10:00" });
  });
  it("rsvp settings: deadline is end of that IST day, blank clears", async () => {
    expect((await updateRsvpSettings(weddingId, { rsvpOpen: false, rsvpDeadline: "2027-01-15" })).ok).toBe(true);
    let [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
    expect(w.rsvpOpen).toBe(false);
    expect(w.rsvpDeadline?.toISOString()).toBe("2027-01-15T18:29:00.000Z");
    await updateRsvpSettings(weddingId, { rsvpOpen: true, rsvpDeadline: "" });
    [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
    expect(w.rsvpDeadline).toBeNull();
  });
  it("travel stored as json", async () => {
    await updateTravel(weddingId, { stays: [{ name: "Taj", note: "Wedding block", url: "" }], gettingThere: "Fly to PNQ" });
    const [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
    expect(w.travel).toEqual({ stays: [{ name: "Taj", note: "Wedding block" }], gettingThere: "Fly to PNQ" });
  });
  it("events: create, edit, hide, reorder, delete — scoped to the wedding", async () => {
    const a = await upsertEvent(weddingId, { name: "Sangeet", date: "2027-01-31", time: "19:00", venueName: "Lawns", address: "Pune", mapUrl: "", isPublished: true });
    const b = await upsertEvent(weddingId, { name: "Pheras", date: "2027-02-01", time: "10:00", venueName: "Temple", address: "Pune", mapUrl: "https://maps.google.com/x", dressCode: "Traditional" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    // edit
    expect((await upsertEvent(weddingId, { id: a.id!, name: "Sangeet Night", date: "2027-01-31", time: "20:30", venueName: "Lawns", address: "Pune" })).ok).toBe(true);
    let rows = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
    expect(rows.map((r) => r.name)).toEqual(["Sangeet Night", "Pheras"]);
    expect(istParts(rows[0].startsAt)).toEqual({ date: "2027-01-31", time: "20:30" });
    // other wedding can't touch it
    expect((await upsertEvent(other, { id: a.id!, name: "Hack", date: "2027-01-31", time: "20:30", venueName: "x", address: "y" })).ok).toBe(false);
    expect((await deleteEvent(other, a.id!)).ok).toBe(false);
    // hide → gone from public
    await setEventPublished(weddingId, b.id!, false);
    expect((await getPublicWedding("ed1"))?.events.map((e) => e.name)).toEqual(["Sangeet Night"]);
    await setEventPublished(weddingId, b.id!, true);
    // reorder
    await moveEvent(weddingId, b.id!, "up");
    rows = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
    expect(rows.map((r) => r.name)).toEqual(["Pheras", "Sangeet Night"]);
    await sortEventsByTime(weddingId);
    rows = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
    expect(rows.map((r) => r.name)).toEqual(["Sangeet Night", "Pheras"]);
    // delete
    expect((await deleteEvent(weddingId, a.id!)).ok).toBe(true);
    expect((await db.select().from(events).where(eq(events.weddingId, weddingId))).length).toBe(1);
  });
});
