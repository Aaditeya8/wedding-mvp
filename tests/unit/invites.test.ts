import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps, emailLog } from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import { issueInvites } from "@/lib/invites";

let weddingId: string, famResponded: string, famFresh: string;

function lastOutboxLines(n: number) {
  const lines = fs.readFileSync("var/outbox/mail.jsonl", "utf8").trim().split("\n");
  return lines.slice(-n).map((l) => JSON.parse(l));
}

beforeAll(async () => {
  process.env.EMAIL_MODE = "file";
  await migrateDb();
  const [w] = await db.insert(weddings).values({
    slug: "inv1", brideName: "A", groomName: "B",
    theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
  }).returning();
  weddingId = w.id;
  const [e1] = await db.insert(events).values({ weddingId, name: "Sangeet", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 }).returning();

  const [f1] = await db.insert(families).values({
    weddingId, name: "Responded Family", side: "bride", email: "resp@example.com",
  }).returning();
  famResponded = f1.id;
  await db.insert(guests).values({ familyId: f1.id, fullName: "R One" });
  await db.insert(eventInvites).values({ eventId: e1.id, familyId: f1.id });
  await db.insert(rsvps).values({ eventId: e1.id, familyId: f1.id, status: "attending", headcount: 1 });

  const [f2] = await db.insert(families).values({
    weddingId, name: "Fresh Family", side: "groom", email: "fresh@example.com",
  }).returning();
  famFresh = f2.id;
  await db.insert(guests).values({ familyId: f2.id, fullName: "F One" });
  await db.insert(eventInvites).values({ eventId: e1.id, familyId: f2.id });
});

describe("issueInvites", () => {
  it("invite mints a token whose hash matches the stored hash", async () => {
    const res = await issueInvites(weddingId, [famFresh], "invite");
    expect(res).toEqual([{ familyId: famFresh, ok: true }]);
    const [fam] = await db.select().from(families).where(eq(families.id, famFresh));
    expect(fam.inviteTokenHash).toBeTruthy();
    const [mail] = lastOutboxLines(1);
    const token = mail.rsvpUrl.split("/rsvp/")[1];
    expect(hashToken(token)).toBe(fam.inviteTokenHash);
  });

  it("resend rotates the token hash", async () => {
    const [before] = await db.select().from(families).where(eq(families.id, famFresh));
    const res = await issueInvites(weddingId, [famFresh], "resend");
    expect(res[0].ok).toBe(true);
    const [after] = await db.select().from(families).where(eq(families.id, famFresh));
    expect(after.inviteTokenHash).not.toBe(before.inviteTokenHash);
    const [mail] = lastOutboxLines(1);
    expect(hashToken(mail.rsvpUrl.split("/rsvp/")[1])).toBe(after.inviteTokenHash);
  });

  it("remind skips families that responded to every invited event", async () => {
    const res = await issueInvites(weddingId, [famResponded, famFresh], "remind");
    expect(res.find((r) => r.familyId === famResponded)).toMatchObject({ ok: false, error: "already responded" });
    expect(res.find((r) => r.familyId === famFresh)).toMatchObject({ ok: true });
  });

  it("writes email_log rows for every send", async () => {
    const logs = await db.select().from(emailLog).where(eq(emailLog.familyId, famFresh));
    expect(logs.length).toBeGreaterThanOrEqual(3); // invite + resend + reminder
    expect(logs.every((l) => l.status === "sent")).toBe(true);
  });

  it("rejects families outside the wedding", async () => {
    const [other] = await db.insert(weddings).values({
      slug: "inv2", brideName: "C", groomName: "D",
      theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
    }).returning();
    const res = await issueInvites(other.id, [famFresh], "invite");
    expect(res[0]).toMatchObject({ ok: false, error: "family not in wedding" });
  });
});
