import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { users } from "@/db/schema";
import { isProvisionedStaff } from "@/lib/authz";

describe("isProvisionedStaff", () => {
  beforeAll(async () => {
    await migrateDb();
    await db.insert(users).values({ email: "staff@example.com", role: "committee" }).onConflictDoNothing();
  });
  it("allows provisioned, rejects unknown and null", async () => {
    expect(await isProvisionedStaff("staff@example.com")).toBe(true);
    expect(await isProvisionedStaff("stranger@example.com")).toBe(false);
    expect(await isProvisionedStaff(null)).toBe(false);
  });
});
