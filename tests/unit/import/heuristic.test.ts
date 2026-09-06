import { describe, it, expect } from "vitest";
import { profileColumns } from "@/lib/import/profile";
import { heuristicMapping } from "@/lib/import/heuristic";
import { buildQuestions, type EventRef } from "@/lib/import/mapping";
import type { Sheet } from "@/lib/import/spreadsheet";

const EVENTS: EventRef[] = [
  { id: "e-haldi", name: "Haldi", sortOrder: 0 },
  { id: "e-mehendi", name: "Mehendi", sortOrder: 1 },
  { id: "e-sangeet", name: "Sangeet", sortOrder: 2 },
  { id: "e-pheras", name: "Pheras", sortOrder: 3 },
  { id: "e-reception", name: "Reception", sortOrder: 4 },
];

function sheet(headers: string[], rows: string[][]): Sheet {
  return { name: "S", headerRow: 0, headers, rows };
}

const PLANNER = sheet(
  ["S.No", "Guest Name", "Family", "Side", "Relation", "Email", "Mobile", "Haldi", "Sangeet", "Wedding", "Reception"],
  [
    ["1", "Rajesh Sharma", "Sharma", "Bride", "Parents", "sharma@x.com", "9876543210", "Y", "Y", "Y", "Y"],
    ["2", "Sunita Sharma", "Sharma", "Bride", "Parents", "sharma@x.com", "9876543211", "Y", "Y", "Y", "Y"],
    ["3", "Vikram Mehta", "Mehta", "Groom", "Parents", "mehta@x.com", "9876543212", "N", "Y", "Y", "Y"],
    ["4", "Zoya Khan", "Khan", "Groom", "Friends", "khan@x.com", "", "N", "Y", "N", "Y"],
  ],
);

describe("heuristicMapping", () => {
  it("maps a per-guest planner sheet: fields, event columns, guest granularity", () => {
    const m = heuristicMapping(profileColumns(PLANNER), EVENTS);
    expect(m.granularity).toBe("guest");
    expect(m.fields).toMatchObject({ guestName: 1, familyName: 2, side: 3, relation: 4, email: 5 });
    expect(m.fields.headcount ?? null).toBeNull();
    expect(m.fields.eventsList ?? null).toBeNull();
    expect(m.eventColumns).toEqual({ "e-haldi": 7, "e-sangeet": 8, "e-pheras": 9, "e-reception": 10 });
    expect(m.confidence.email).toBeGreaterThanOrEqual(0.9);
  });

  it("ignores serial-number columns and never maps the mobile column", () => {
    const m = heuristicMapping(profileColumns(PLANNER), EVENTS);
    const used = new Set(Object.values(m.fields).filter((v) => v !== null && v !== undefined));
    expect(used.has(0)).toBe(false);
    expect(used.has(6)).toBe(false);
  });

  it("maps a per-family sheet with a names cell and an events list", () => {
    const s = sheet(
      ["Family", "Names", "Bride/Groom", "Email ID", "No. of people", "Events"],
      [
        ["Sharma Family", "Rajesh, Sunita", "Bride", "sharma@x.com", "2", "Haldi, Sangeet, Wedding"],
        ["The Khans", "Zoya & Imran", "Groom", "khan@x.com", "2", "Sangeet, Reception"],
      ],
    );
    const m = heuristicMapping(profileColumns(s), EVENTS);
    expect(m.granularity).toBe("family");
    expect(m.fields).toMatchObject({ familyName: 0, guestName: 1, side: 2, email: 3, headcount: 4, eventsList: 5 });
    expect(m.eventColumns).toEqual({});
  });

  it("falls back to value kinds when headers are unhelpful", () => {
    const s = sheet(
      ["Column A", "Column B", "Column C"],
      [["Sharma Family", "sharma@x.com", "Y"], ["Mehta Family", "mehta@x.com", "N"]],
    );
    const m = heuristicMapping(profileColumns(s), EVENTS);
    expect(m.fields.email).toBe(1);
    expect(m.confidence.email).toBeLessThan(0.9);
  });

  it("treats a single Name column with repeated emails as one person per row", () => {
    const s = sheet(
      ["Name", "Email"],
      [["A", "same@x.com"], ["B", "same@x.com"], ["C", "other@x.com"]],
    );
    expect(heuristicMapping(profileColumns(s), EVENTS).granularity).toBe("guest");
  });
});

describe("buildQuestions", () => {
  it("asks granularity always, and groupBy (defaulting to the family column) for per-guest sheets", () => {
    const profiles = profileColumns(PLANNER);
    const m = heuristicMapping(profiles, EVENTS);
    const qs = buildQuestions(m, profiles, EVENTS, 0);
    const ids = qs.map((q) => q.id);
    expect(ids).toEqual(["granularity", "groupBy"]);
    const g = qs.find((q) => q.id === "groupBy")!;
    expect(g.default).toBe("column:2");
    expect(g.options.map((o) => o.value)).toEqual(["column:2", "email", "surname", "none"]);
  });

  it("asks which events to use when the sheet carries no event information", () => {
    const s = sheet(["Family", "Email"], [["Sharma", "s@x.com"]]);
    const profiles = profileColumns(s);
    const m = heuristicMapping(profiles, EVENTS);
    const qs = buildQuestions(m, profiles, EVENTS, 0);
    const ev = qs.find((q) => q.id === "events")!;
    expect(ev.default).toBe("all");
    expect(ev.options.map((o) => o.value)).toEqual(["all", "main", "choose"]);
    expect(ev.choices?.map((c) => c.value)).toEqual(EVENTS.map((e) => e.id));
  });

  it("asks about missing emails only when some rows lack one", () => {
    const s = sheet(["Family", "Email"], [["Sharma", "s@x.com"]]);
    const profiles = profileColumns(s);
    const m = heuristicMapping(profiles, EVENTS);
    expect(buildQuestions(m, profiles, EVENTS, 0).some((q) => q.id === "missingEmail")).toBe(false);
    const q = buildQuestions(m, profiles, EVENTS, 3).find((q) => q.id === "missingEmail")!;
    expect(q.text).toMatch(/3 /);
    expect(q.default).toBe("import");
  });
});
