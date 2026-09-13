import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, migrateDb } from "@/db/client";
import { weddings, events, users } from "@/db/schema";
import { createWeddingForCouple } from "@/lib/signup";

beforeAll(async () => { await migrateDb(); });

const input = { brideName: "Meera", groomName: "Dev", weddingDate: "2027-02-14", city: "Jaipur", email: "Meera@Example.com" };

describe("createWeddingForCouple", () => {
  it("creates wedding, starter events and couple login", async () => {
    const r = await createWeddingForCouple(input);
    expect(r).toMatchObject({ ok: true, created: true, slug: "meera-weds-dev", email: "meera@example.com" });
    if (!r.ok || !r.created) return;
    const evs = await db.select().from(events).where(eq(events.weddingId, r.weddingId));
    expect(evs.map((e) => e.name)).toEqual(["Haldi", "Mehendi", "Sangeet", "Pheras", "Reception"]);
    expect(evs.every((e) => e.address === "Jaipur" && e.isPublished)).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.email, "meera@example.com"));
    expect(u).toMatchObject({ role: "couple", weddingId: r.weddingId });
    const [w] = await db.select().from(weddings).where(eq(weddings.id, r.weddingId));
    expect(w.city).toBe("Jaipur");
  });
  it("same email again → sign-in, no second wedding", async () => {
    const r = await createWeddingForCouple({ ...input, brideName: "Other" });
    expect(r).toMatchObject({ ok: true, created: false });
    expect((await db.select().from(weddings)).length).toBe(1);
  });
  it("same names, different email → suffixed slug", async () => {
    const r = await createWeddingForCouple({ ...input, email: "dev@example.com" });
    expect(r).toMatchObject({ ok: true, created: true, slug: "meera-weds-dev-2" });
  });
  it("rejects garbage", async () => {
    expect(await createWeddingForCouple({ ...input, email: "nope" })).toEqual({ ok: false, error: "invalid input" });
    expect(await createWeddingForCouple({ ...input, weddingDate: "14/02/2027" })).toEqual({ ok: false, error: "invalid input" });
  });
});
