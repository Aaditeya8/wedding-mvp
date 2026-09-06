import { describe, it, expect } from "vitest";
import { profileColumns } from "@/lib/import/profile";
import { parseSide, parseAgeGroup, parseBoolean, matchEventName, normalizeHeader, TARGET_FIELDS } from "@/lib/import/targets";
import type { Sheet } from "@/lib/import/spreadsheet";

function sheet(headers: string[], rows: string[][]): Sheet {
  return { name: "S", headerRow: 0, headers, rows };
}

describe("profileColumns", () => {
  it("classifies email, phone, number, boolean, text and empty columns", () => {
    const s = sheet(
      ["Email", "Mobile", "Count", "Sangeet", "Name", "Notes"],
      [
        ["a@x.com", "+91 98765 43210", "2", "Y", "Asha", ""],
        ["b@x.com", "9876543210", "4", "N", "Bala", ""],
        ["not-an-email", "(022) 2345-6789", "1", "yes", "Chitra", ""],
      ],
    );
    const kinds = profileColumns(s).map((p) => p.kind);
    expect(kinds).toEqual(["email", "phone", "number", "boolean", "text", "empty"]);
  });

  it("reports fill rate, distinct count and up to five distinct samples", () => {
    const rows = ["a", "b", "a", "", "c", "d", "e", "f", "g"].map((v) => [v]);
    const [p] = profileColumns(sheet(["Side"], rows));
    expect(p.index).toBe(0);
    expect(p.header).toBe("Side");
    expect(p.fillRate).toBeCloseTo(8 / 9);
    expect(p.distinct).toBe(7);
    expect(p.samples).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("targets vocabulary", () => {
  it("normalises headers", () => {
    expect(normalizeHeader("  E-mail ID / Address ")).toBe("email id address");
  });

  it("lists every target field with a label", () => {
    expect(TARGET_FIELDS.map((f) => f.id)).toEqual([
      "familyName", "guestName", "side", "relation", "email", "ageGroup", "headcount", "eventsList",
    ]);
    for (const f of TARGET_FIELDS) expect(f.label.length).toBeGreaterThan(0);
  });

  it("parses side synonyms including Hindi and short forms", () => {
    expect(parseSide("Bride")).toBe("bride");
    expect(parseSide("b")).toBe("bride");
    expect(parseSide("Ladki wale")).toBe("bride");
    expect(parseSide("Dulhan")).toBe("bride");
    expect(parseSide("groom's side")).toBe("groom");
    expect(parseSide("G")).toBe("groom");
    expect(parseSide("Ladka")).toBe("groom");
    expect(parseSide("Both")).toBe("both");
    expect(parseSide("Common friends")).toBe("both");
    expect(parseSide("Dono")).toBe("both");
    expect(parseSide("")).toBeNull();
    expect(parseSide("Mumbai")).toBeNull();
  });

  it("parses age group from words and numeric ages", () => {
    expect(parseAgeGroup("Child")).toBe("child");
    expect(parseAgeGroup("kid")).toBe("child");
    expect(parseAgeGroup("7")).toBe("child");
    expect(parseAgeGroup("32")).toBe("adult");
    expect(parseAgeGroup("Adult")).toBe("adult");
    expect(parseAgeGroup("")).toBeNull();
  });

  it("parses booleans generously", () => {
    for (const v of ["Y", "yes", "TRUE", "1", "✓", "x", "invited", "attending"]) expect(parseBoolean(v)).toBe(true);
    for (const v of ["N", "no", "FALSE", "0", "-", "", "—"]) expect(parseBoolean(v)).toBe(false);
    expect(parseBoolean("maybe later")).toBeNull();
  });

  it("matches event names through synonyms against the wedding's real events", () => {
    const evs = ["Haldi", "Mehendi", "Sangeet", "Pheras", "Reception"];
    expect(matchEventName("Wedding", evs)).toBe("Pheras");
    expect(matchEventName("Shaadi", evs)).toBe("Pheras");
    expect(matchEventName("Mehndi", evs)).toBe("Mehendi");
    expect(matchEventName("Sangeet night", evs)).toBe("Sangeet");
    expect(matchEventName("reception (Mumbai)", evs)).toBe("Reception");
    expect(matchEventName("Haldi", evs)).toBe("Haldi");
    expect(matchEventName("Mobile", evs)).toBeNull();
    expect(matchEventName("Cocktail", ["Cocktail Night", "Pheras"])).toBe("Cocktail Night");
  });
});
