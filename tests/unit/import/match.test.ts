import { describe, it, expect } from "vitest";
import { matchExisting, normalizeFamilyName, normalizePersonName, type ExistingFamily } from "@/lib/import/match";
import type { ImportRow } from "@/lib/import/normalize";

const EXISTING: ExistingFamily[] = [
  { id: "f1", name: "Sharma Family", email: "sharma@x.com", members: ["Rajesh Sharma", "Sunita Sharma"] },
  { id: "f2", name: "Wadiker", email: "", members: ["Wadiker masa", "Sonu", "Tush"] },
  { id: "f3", name: "The Khans", email: "khan@x.com", members: ["Zoya Khan"] },
  { id: "f4", name: "Bhosale Family", email: "", members: ["Guest 1", "Guest 2"] },
];

function row(over: Partial<Omit<ImportRow, "members">> & { name: string; members?: string[] }): ImportRow {
  const { members, ...rest } = over;
  return {
    key: "k", side: "both", relation: "", email: "", eventIds: [], issues: [], sourceRows: [],
    ...rest,
    members: (members ?? [over.name]).map((n) => ({ fullName: n, ageGroup: "adult" as const })),
  };
}

describe("normalizeFamilyName", () => {
  it("strips family words, articles, honorifics, possessives and plurals", () => {
    expect(normalizeFamilyName("The Sharma Family")).toBe("sharma");
    expect(normalizeFamilyName("Sharma Parivar")).toBe("sharma");
    expect(normalizeFamilyName("Wadiker ji & family")).toBe("wadiker");
    expect(normalizeFamilyName("Mama's House")).toBe("mama");
    expect(normalizeFamilyName("The Khans")).toBe("khan");
    expect(normalizeFamilyName("Chachu & Family")).toBe("chachu");
    expect(normalizeFamilyName("D'Souza family")).toBe("dsouza");
  });
  it("normalises person names and ignores placeholders", () => {
    expect(normalizePersonName("  Dr. Rajesh   Sharma ")).toBe("rajesh sharma");
    expect(normalizePersonName("Guest 3")).toBeNull();
  });
});

describe("matchExisting", () => {
  it("matches by email first, case-insensitively", () => {
    expect(matchExisting(row({ name: "Totally Different", email: "SHARMA@x.com" }), EXISTING)).toEqual({ id: "f1", reason: "email" });
  });
  it("matches by normalised household name when there is no email", () => {
    expect(matchExisting(row({ name: "Wadiker Family" }), EXISTING)).toEqual({ id: "f2", reason: "name" });
    expect(matchExisting(row({ name: "Khan Family" }), EXISTING)).toEqual({ id: "f3", reason: "name" });
  });
  it("never matches by name or people when both sides have different emails", () => {
    expect(matchExisting(row({ name: "Sharma Family", email: "other-sharma@x.com" }), EXISTING)).toBeNull();
    expect(matchExisting(row({ name: "Whoever", email: "new@x.com", members: ["Sonu", "Tush"] }), [{ ...EXISTING[1], email: "wadiker@x.com" }])).toBeNull();
  });
  it("matches by member overlap when names differ", () => {
    expect(matchExisting(row({ name: "Masa's group", members: ["Sonu", "Tush", "New Person"] }), EXISTING)).toEqual({ id: "f2", reason: "members" });
  });
  it("does not match on weak overlap, placeholders, or unrelated rows", () => {
    expect(matchExisting(row({ name: "Gupta Family", members: ["Manoj Gupta"] }), EXISTING)).toBeNull();
    expect(matchExisting(row({ name: "Big Group", members: ["Sonu", "A", "B", "C", "D"] }), EXISTING)).toBeNull();
    expect(matchExisting(row({ name: "Another", members: ["Guest 1", "Guest 2"] }), EXISTING)).toBeNull();
  });
});
