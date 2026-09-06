import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites } from "@/db/schema";
import { commitImport, findExistingEmails } from "@/lib/import/commit";
import type { ImportRow } from "@/lib/import/normalize";

let weddingId: string, otherWeddingId: string, sangeet: string, pheras: string, foreignEvent: string;

function row(over: Partial<ImportRow> & { key: string; name: string }): ImportRow {
  return {
    side: "bride", relation: "", email: "", members: [{ fullName: over.name, ageGroup: "adult" }],
    eventIds: [sangeet], issues: [], sourceRows: [], ...over,
  };
}

beforeAll(async () => {
  await migrateDb();
  const [w] = await db.insert(weddings).values({ slug: "imp1", brideName: "A", groomName: "B", theme: "ivory-editorial", weddingDate: new Date("2026-11-20") }).returning();
  weddingId = w.id;
  const [o] = await db.insert(weddings).values({ slug: "imp2", brideName: "C", groomName: "D", theme: "ivory-editorial", weddingDate: new Date("2026-11-20") }).returning();
  otherWeddingId = o.id;
  const [e1] = await db.insert(events).values({ weddingId, name: "Sangeet", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 }).returning();
  const [e2] = await db.insert(events).values({ weddingId, name: "Pheras", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 1 }).returning();
  const [e3] = await db.insert(events).values({ weddingId: otherWeddingId, name: "Reception", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 }).returning();
  sangeet = e1.id; pheras = e2.id; foreignEvent = e3.id;
  await db.insert(families).values({ weddingId, name: "Already Here", side: "groom", email: "Here@Example.com" });
});

describe("findExistingEmails", () => {
  it("returns lower-cased emails of the wedding's families only", async () => {
    const map = await findExistingEmails(weddingId);
    expect([...map.keys()]).toEqual(["here@example.com"]);
    expect(await findExistingEmails(otherWeddingId)).toEqual(new Map());
  });
});

describe("commitImport", () => {
  it("creates families with members and event invites", async () => {
    const res = await commitImport(weddingId, [
      row({ key: "a", name: "Sharma Family", email: "sharma@x.com", relation: "Parents",
        members: [{ fullName: "Rajesh Sharma", ageGroup: "adult" }, { fullName: "Aarav Sharma", ageGroup: "child" }],
        eventIds: [sangeet, pheras] }),
      row({ key: "b", name: "Solo", email: "" }),
    ], { onExisting: "skip" });
    expect(res).toEqual({ created: 2, updated: 0, skipped: 0, errors: [] });
    const [fam] = await db.select().from(families).where(eq(families.email, "sharma@x.com"));
    expect(fam).toMatchObject({ weddingId, name: "Sharma Family", side: "bride", relation: "Parents" });
    const members = await db.select().from(guests).where(eq(guests.familyId, fam.id));
    expect(members.map((m) => [m.fullName, m.ageGroup])).toEqual([["Rajesh Sharma", "adult"], ["Aarav Sharma", "child"]]);
    const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, fam.id));
    expect(invites.map((i) => i.eventId).sort()).toEqual([sangeet, pheras].sort());
    const [solo] = await db.select().from(families).where(eq(families.name, "Solo"));
    expect(solo.email).toBe("");
  });

  it("skips households whose email already exists when asked to skip", async () => {
    const res = await commitImport(weddingId, [
      row({ key: "a", name: "Sharma Family (again)", email: "SHARMA@x.com" }),
      row({ key: "c", name: "New Family", email: "new@x.com" }),
    ], { onExisting: "skip" });
    expect(res).toMatchObject({ created: 1, updated: 0, skipped: 1 });
    const all = await db.select().from(families).where(eq(families.email, "sharma@x.com"));
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Sharma Family");
  });

  it("updates an existing household in place, replacing members and invites, when asked to update", async () => {
    const res = await commitImport(weddingId, [
      row({ key: "a", name: "Sharma Parivaar", email: "sharma@x.com", side: "both",
        members: [{ fullName: "Sunita Sharma", ageGroup: "adult" }], eventIds: [pheras] }),
    ], { onExisting: "update" });
    expect(res).toMatchObject({ created: 0, updated: 1, skipped: 0 });
    const fams = await db.select().from(families).where(eq(families.email, "sharma@x.com"));
    expect(fams).toHaveLength(1);
    expect(fams[0]).toMatchObject({ name: "Sharma Parivaar", side: "both" });
    const members = await db.select().from(guests).where(eq(guests.familyId, fams[0].id));
    expect(members.map((m) => m.fullName)).toEqual(["Sunita Sharma"]);
    const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, fams[0].id));
    expect(invites.map((i) => i.eventId)).toEqual([pheras]);
  });

  it("reports rows with a missing name or a foreign event and still creates the rest", async () => {
    const res = await commitImport(weddingId, [
      row({ key: "x", name: "", email: "x@x.com" }),
      row({ key: "y", name: "Wrong Event", email: "y@x.com", eventIds: [foreignEvent] }),
      row({ key: "z", name: "Fine Family", email: "z@x.com" }),
    ], { onExisting: "skip" });
    expect(res.created).toBe(1);
    expect(res.errors.map((e) => e.key).sort()).toEqual(["x", "y"]);
    expect(await db.select().from(families).where(eq(families.email, "y@x.com"))).toHaveLength(0);
    expect(await db.select().from(families).where(eq(families.email, "z@x.com"))).toHaveLength(1);
  });

  it("merges into a household matched by name: keeps its name, adds new people, unions events, fills blanks", async () => {
    const res = await commitImport(weddingId, [
      row({ key: "m", name: "Fine Parivar", email: "", relation: "Neighbours",
        members: [{ fullName: "Fine Family", ageGroup: "adult" }, { fullName: "Baby Fine", ageGroup: "child" }],
        eventIds: [pheras] }),
    ], { onExisting: "merge" });
    expect(res).toMatchObject({ created: 0, updated: 1, skipped: 0, errors: [] });
    const fams = await db.select().from(families).where(eq(families.email, "z@x.com"));
    expect(fams).toHaveLength(1);
    expect(fams[0]).toMatchObject({ name: "Fine Family", relation: "Neighbours" });
    const members = await db.select().from(guests).where(eq(guests.familyId, fams[0].id));
    expect(members.map((m) => [m.fullName, m.ageGroup])).toEqual([["Fine Family", "adult"], ["Baby Fine", "child"]]);
    const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, fams[0].id));
    expect(invites.map((i) => i.eventId).sort()).toEqual([sangeet, pheras].sort());
  });

  it("re-importing the same list with merge changes nothing and reports it as updated, not created", async () => {
    const before = await db.select().from(families).where(eq(families.weddingId, weddingId));
    const res = await commitImport(weddingId, [
      row({ key: "r", name: "Fine Family", email: "", members: [{ fullName: "Fine Family", ageGroup: "adult" }], eventIds: [sangeet] }),
    ], { onExisting: "merge" });
    expect(res).toMatchObject({ created: 0, updated: 1 });
    const after = await db.select().from(families).where(eq(families.weddingId, weddingId));
    expect(after).toHaveLength(before.length);
  });
});
