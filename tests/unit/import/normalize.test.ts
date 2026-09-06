import { describe, it, expect } from "vitest";
import { buildRows, splitNames, parseMembersCell } from "@/lib/import/normalize";
import { EMPTY_FIELDS, type EventRef, type Mapping } from "@/lib/import/mapping";
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
function mapping(partial: Partial<Mapping> & { fields?: Partial<Mapping["fields"]> }): Mapping {
  return {
    granularity: partial.granularity ?? "family",
    fields: { ...EMPTY_FIELDS, ...(partial.fields ?? {}) },
    eventColumns: partial.eventColumns ?? {},
    confidence: {},
  };
}

describe("splitNames / parseMembersCell", () => {
  it("splits on commas, ampersands, 'and', slashes and newlines", () => {
    expect(splitNames("Rajesh, Sunita & Aarav and Myra / Dev\nRiya")).toEqual(["Rajesh", "Sunita", "Aarav", "Myra", "Dev", "Riya"]);
    expect(splitNames("")).toEqual([]);
  });
  it("reads child markers and ages out of a names cell", () => {
    expect(parseMembersCell("Rohit Mehta, Neha Mehta, Aarav (child), Myra (6)")).toEqual([
      { fullName: "Rohit Mehta", ageGroup: "adult" },
      { fullName: "Neha Mehta", ageGroup: "adult" },
      { fullName: "Aarav", ageGroup: "child" },
      { fullName: "Myra", ageGroup: "child" },
    ]);
  });
});

describe("buildRows — one person per row", () => {
  const PLANNER = sheet(
    ["Guest Name", "Family", "Side", "Relation", "Email", "Age", "Haldi", "Sangeet", "Wedding", "Reception"],
    [
      ["Rajesh Sharma", "Sharma", "Bride", "Parents", "sharma@x.com", "58", "Y", "Y", "Y", "Y"],
      ["Sunita Sharma", "Sharma", "Bride", "Parents", "", "55", "Y", "Y", "Y", "Y"],
      ["Aarav Sharma", "Sharma", "", "", "", "7", "N", "Y", "Y", "Y"],
      ["Vikram Mehta", "Mehta", "Groom", "Parents", "MEHTA@x.com", "", "N", "Y", "Y", "Y"],
      ["Zoya Khan", "", "Ladka", "Friends", "", "", "N", "Y", "N", "Y"],
    ],
  );
  const M = mapping({
    granularity: "guest",
    fields: { guestName: 0, familyName: 1, side: 2, relation: 3, email: 4, ageGroup: 5 },
    eventColumns: { "e-haldi": 6, "e-sangeet": 7, "e-pheras": 8, "e-reception": 9 },
  });

  it("groups by the family column, merging members, side, email and the union of events", () => {
    const { rows, stats } = buildRows(PLANNER, M, { groupBy: "column:1" }, EVENTS);
    expect(stats).toEqual({ sourceRows: 5, households: 3, withIssues: 1 });
    const sharma = rows[0];
    expect(sharma.name).toBe("Sharma Family");
    expect(sharma.side).toBe("bride");
    expect(sharma.relation).toBe("Parents");
    expect(sharma.email).toBe("sharma@x.com");
    expect(sharma.members).toEqual([
      { fullName: "Rajesh Sharma", ageGroup: "adult" },
      { fullName: "Sunita Sharma", ageGroup: "adult" },
      { fullName: "Aarav Sharma", ageGroup: "child" },
    ]);
    expect(sharma.eventIds).toEqual(["e-haldi", "e-sangeet", "e-pheras", "e-reception"]);
    expect(sharma.issues).toEqual([]);
    expect(sharma.sourceRows).toEqual([0, 1, 2]);
    expect(rows[1]).toMatchObject({ name: "Mehta Family", email: "mehta@x.com", side: "groom" });
  });

  it("gives a row with an empty group value its own household and flags a missing email", () => {
    const { rows } = buildRows(PLANNER, M, { groupBy: "column:1" }, EVENTS);
    const zoya = rows[2];
    expect(zoya.name).toBe("Zoya Khan");
    expect(zoya.side).toBe("groom");
    expect(zoya.members).toEqual([{ fullName: "Zoya Khan", ageGroup: "adult" }]);
    expect(zoya.eventIds).toEqual(["e-sangeet", "e-reception"]);
    expect(zoya.issues).toEqual(["missing_email"]);
  });

  it("groups by surname when asked", () => {
    const { rows } = buildRows(PLANNER, M, { groupBy: "surname" }, EVENTS);
    expect(rows.map((r) => r.name)).toEqual(["Sharma Family", "Mehta Family", "Khan Family"]);
  });

  it("groups by email when asked, giving each email-less row its own household", () => {
    const { rows } = buildRows(PLANNER, M, { groupBy: "email" }, EVENTS);
    expect(rows).toHaveLength(5);
  });

  it("makes every row its own household with groupBy none", () => {
    const { rows } = buildRows(PLANNER, M, { groupBy: "none" }, EVENTS);
    expect(rows).toHaveLength(5);
    expect(rows[0].name).toBe("Rajesh Sharma");
  });

  it("skips email-less rows when the answer says so", () => {
    const { rows } = buildRows(PLANNER, M, { groupBy: "column:1", missingEmail: "skip" }, EVENTS);
    expect(rows.map((r) => r.name)).toEqual(["Sharma Family", "Mehta Family"]);
  });
});

describe("buildRows — one household per row", () => {
  const FAMILY = sheet(
    ["Family", "Names", "Side", "Email", "People", "Events"],
    [
      ["Sharma Family", "Rajesh, Sunita & Aarav (child)", "Bride", "sharma@x.com", "", "Haldi, Sangeet, Wedding"],
      ["The Khans", "", "Groom", "khan@x.com", "3", "Sangeet; Reception"],
      ["The Guptas", "", "Common", "gupta@", "", "Cocktail"],
      ["", "Solo Singh", "Groom", "sharma@x.com", "", ""],
      ["Bua's House", "Meena Kapoor", "Aunty", "", "", "Reception"],
    ],
  );
  const M = mapping({
    granularity: "family",
    fields: { familyName: 0, guestName: 1, side: 2, email: 3, headcount: 4, eventsList: 5 },
  });

  it("splits a names cell, reads an events list, and creates placeholders from a headcount", () => {
    const { rows } = buildRows(FAMILY, M, {}, EVENTS);
    expect(rows[0].members).toEqual([
      { fullName: "Rajesh", ageGroup: "adult" }, { fullName: "Sunita", ageGroup: "adult" }, { fullName: "Aarav", ageGroup: "child" },
    ]);
    expect(rows[0].eventIds).toEqual(["e-haldi", "e-sangeet", "e-pheras"]);
    expect(rows[1].members).toEqual([
      { fullName: "Guest 1", ageGroup: "adult" }, { fullName: "Guest 2", ageGroup: "adult" }, { fullName: "Guest 3", ageGroup: "adult" },
    ]);
    expect(rows[1].eventIds).toEqual(["e-sangeet", "e-reception"]);
  });

  it("flags invalid emails, unknown events, missing members, missing names, unknown sides and duplicate emails", () => {
    const { rows } = buildRows(FAMILY, M, {}, EVENTS);
    expect(rows[2].issues).toEqual(expect.arrayContaining(["invalid_email", "no_members", "no_events"]));
    expect(rows[2].email).toBe("gupta@");
    expect(rows[2].members).toEqual([{ fullName: "The Guptas", ageGroup: "adult" }]);
    expect(rows[3].name).toBe("Singh Family");
    expect(rows[3].issues).toEqual(expect.arrayContaining(["duplicate_in_sheet", "no_events"]));
    expect(rows[4].side).toBe("both");
    expect(rows[4].issues).toEqual(expect.arrayContaining(["unknown_side", "missing_email"]));
  });

  it("uses the default-events answer when the sheet has no event information", () => {
    const S = sheet(["Family", "Email"], [["Sharma Family", "s@x.com"], ["Mehta Family", "m@x.com"]]);
    const M2 = mapping({ fields: { familyName: 0, email: 1 } });
    expect(buildRows(S, M2, {}, EVENTS).rows[0].eventIds).toEqual(EVENTS.map((e) => e.id));
    expect(buildRows(S, M2, { events: "main" }, EVENTS).rows[0].eventIds).toEqual(["e-sangeet", "e-pheras", "e-reception"]);
    expect(buildRows(S, M2, { events: "choose", eventsChosen: ["e-reception", "bogus"] }, EVENTS).rows[0].eventIds).toEqual(["e-reception"]);
  });

  it("names a household after its first member when there is no family column", () => {
    const S = sheet(["Names", "Email"], [["Priya Nair, Kabir Bose", "p@x.com"], ["Solo", "s@x.com"]]);
    const M2 = mapping({ fields: { guestName: 0, email: 1 } });
    const { rows } = buildRows(S, M2, {}, EVENTS);
    expect(rows[0].name).toBe("Nair Family");
    expect(rows[1].name).toBe("Solo");
  });
});
