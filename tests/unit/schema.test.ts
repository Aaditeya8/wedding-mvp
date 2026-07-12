import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { weddings, families, guests } from "@/db/schema";

describe("schema", () => {
  beforeAll(async () => { await migrateDb(); });

  it("inserts a wedding with a family and guests", async () => {
    const [w] = await db.insert(weddings).values({
      slug: "test-wed", brideName: "A", groomName: "B",
      theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
    }).returning();
    const [f] = await db.insert(families).values({
      weddingId: w.id, name: "Sharma Family", side: "bride",
      relation: "Mama's family", email: "sharma@example.com",
    }).returning();
    await db.insert(guests).values([
      { familyId: f.id, fullName: "Rakesh Sharma", ageGroup: "adult" },
      { familyId: f.id, fullName: "Pinky Sharma", ageGroup: "child" },
    ]);
    expect(w.theme).toBe("ivory-editorial");
    expect(f.inviteTokenHash).toBeNull();
  });
});
