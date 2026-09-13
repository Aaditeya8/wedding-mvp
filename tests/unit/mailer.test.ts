import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import { db, migrateDb } from "@/db/client";
import { weddings, families, emailLog } from "@/db/schema";
import { sendInvite, fromHeader } from "@/lib/mailer";

describe("sendInvite (file mode)", () => {
  beforeAll(async () => {
    process.env.EMAIL_MODE = "file";
    await migrateDb();
  });

  it("writes outbox line and email_log row", async () => {
    const [w] = await db.insert(weddings).values({
      slug: "m1", brideName: "Ananya", groomName: "Arjun",
      theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
    }).returning();
    const [f] = await db.insert(families).values({
      weddingId: w.id, name: "Mehta Family", side: "groom", email: "mehta@example.com",
    }).returning();

    const res = await sendInvite({
      familyId: f.id, to: f.email, familyName: f.name,
      coupleNames: "Ananya & Arjun",
      rsvpUrl: "http://localhost:3000/rsvp/tok123", theme: w.theme, type: "invite",
    });

    expect(res.ok).toBe(true);
    const lines = fs.readFileSync("var/outbox/mail.jsonl", "utf8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.to).toBe("mehta@example.com");
    expect(last.rsvpUrl).toContain("/rsvp/tok123");
    expect(last.html).toContain("Mehta Family");
    const logs = await db.select().from(emailLog);
    expect(logs.some((l) => l.familyId === f.id && l.status === "sent")).toBe(true);
  });
});

describe("fromHeader", () => {
  const prev = { from: process.env.EMAIL_FROM, user: process.env.SMTP_USER };
  beforeAll(() => {
    process.env.EMAIL_FROM = "Nimantran <hello@example.com>";
    process.env.SMTP_USER = "hello@example.com";
  });
  afterAll(() => {
    process.env.EMAIL_FROM = prev.from; process.env.SMTP_USER = prev.user;
  });

  it("puts the couple's names on the invite so guests recognise the sender", () => {
    expect(fromHeader("Ananya & Arjun")).toBe('"Ananya & Arjun" <hello@example.com>');
  });
  it("falls back to the configured sender with no display name", () => {
    expect(fromHeader()).toBe("Nimantran <hello@example.com>");
  });
  it("strips quotes and newlines that would break the header", () => {
    expect(fromHeader('A"B\r\nBcc: evil@example.com')).toBe('"ABBcc: evil@example.com" <hello@example.com>');
  });
  it("falls back when the name is only strippable characters", () => {
    expect(fromHeader('"""')).toBe("Nimantran <hello@example.com>");
  });
});
