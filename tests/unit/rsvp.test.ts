import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { getFamilyByToken, submitRsvp, getRsvpSummary } from "@/lib/rsvp";

let token: string, eventA: string, eventB: string, weddingId: string;

beforeAll(async () => {
  await migrateDb();
  const [w] = await db.insert(weddings).values({
    slug: "r1", brideName: "A", groomName: "B",
    theme: "raj-mahal", weddingDate: new Date("2026-11-20"),
  }).returning();
  weddingId = w.id;
  const [e1] = await db.insert(events).values({ weddingId, name: "Sangeet", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 }).returning();
  const [e2] = await db.insert(events).values({ weddingId, name: "Pheras", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 1 }).returning();
  eventA = e1.id; eventB = e2.id;
  const t = generateInviteToken(); token = t.token;
  const [f] = await db.insert(families).values({
    weddingId, name: "Rao Family", side: "bride", email: "rao@example.com",
    inviteTokenHash: t.tokenHash, tokenExpiresAt: tokenExpiry(w.weddingDate),
  }).returning();
  await db.insert(guests).values([
    { familyId: f.id, fullName: "P Rao" }, { familyId: f.id, fullName: "Q Rao" },
  ]);
  await db.insert(eventInvites).values([{ eventId: eventA, familyId: f.id }]); // invited to Sangeet only
});

describe("getFamilyByToken", () => {
  it("returns family with only invited events", async () => {
    const res = await getFamilyByToken(token);
    expect(res?.family.name).toBe("Rao Family");
    expect(res?.events.map((e) => e.name)).toEqual(["Sangeet"]);
    expect(res?.members).toHaveLength(2);
  });
  it("returns null for unknown token", async () => {
    expect(await getFamilyByToken("nope")).toBeNull();
  });
});

describe("submitRsvp", () => {
  it("rejects events the family is not invited to", async () => {
    const res = await submitRsvp({ token, responses: [{ eventId: eventB, status: "attending", headcount: 2 }] });
    expect(res).toEqual({ ok: false, error: "not invited to event" });
  });
  it("rejects out-of-range headcount (members+2 max)", async () => {
    const res = await submitRsvp({ token, responses: [{ eventId: eventA, status: "attending", headcount: 5 }] });
    expect(res).toEqual({ ok: false, error: "headcount out of range" });
  });
  it("accepts a valid RSVP and upserts on resubmit", async () => {
    expect((await submitRsvp({ token, responses: [{ eventId: eventA, status: "attending", headcount: 2, note: "veg" }] })).ok).toBe(true);
    expect((await submitRsvp({ token, responses: [{ eventId: eventA, status: "declined", headcount: 3 }] })).ok).toBe(true);
    const fam = await getFamilyByToken(token);
    expect(fam?.events[0].rsvp).toMatchObject({ status: "declined", headcount: 0 }); // declined forces 0
    const summary = await getRsvpSummary(weddingId);
    expect(summary.find((s) => s.eventId === eventA)).toMatchObject({ invitedFamilies: 1, responded: 1, attendingHeadcount: 0 });
  });
});
