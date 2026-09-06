import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook, detectHeaderRow, defaultSheetIndex, MAX_ROWS } from "@/lib/import/spreadsheet";

function xlsxBuffer(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

describe("parseWorkbook", () => {
  it("parses a csv into one sheet with headers and trimmed string rows", () => {
    const csv = "Name , Email,Side\n Rajesh Sharma , sharma@x.com , Bride\nKavita Mehta,mehta@x.com,Groom\n";
    const [sheet] = parseWorkbook(new TextEncoder().encode(csv), "guests.csv");
    expect(sheet.headers).toEqual(["Name", "Email", "Side"]);
    expect(sheet.headerRow).toBe(0);
    expect(sheet.rows).toEqual([
      ["Rajesh Sharma", "sharma@x.com", "Bride"],
      ["Kavita Mehta", "mehta@x.com", "Groom"],
    ]);
  });

  it("finds the header row under a title row in an xlsx and formats dates", () => {
    const buf = xlsxBuffer({
      "Guest List": [
        ["Ananya weds Arjun — guest list"],
        [],
        ["Family", "Email", "Arrival"],
        ["Sharma Family", "sharma@x.com", new Date(2026, 10, 20)],
        ["Mehta Family", "mehta@x.com", 4],
      ],
    });
    const [sheet] = parseWorkbook(buf, "guests.xlsx");
    expect(sheet.name).toBe("Guest List");
    expect(sheet.headerRow).toBe(2);
    expect(sheet.headers).toEqual(["Family", "Email", "Arrival"]);
    expect(sheet.rows[0]).toEqual(["Sharma Family", "sharma@x.com", "2026-11-20"]);
    expect(sheet.rows[1]).toEqual(["Mehta Family", "mehta@x.com", "4"]);
  });

  it("drops sheets with no data rows and skips blank rows", () => {
    const buf = xlsxBuffer({
      Notes: [["just a title"]],
      Empty: [],
      Guests: [["Name", "Email"], [], ["A", "a@x.com"], ["", ""], ["B", "b@x.com"]],
    });
    const sheets = parseWorkbook(buf, "g.xlsx");
    expect(sheets.map((s) => s.name)).toEqual(["Guests"]);
    expect(sheets[0].rows).toHaveLength(2);
  });

  it("renames blank and duplicate headers", () => {
    const buf = xlsxBuffer({ S: [["Name", "", "Name"], ["a", "b", "c"]] });
    const [sheet] = parseWorkbook(buf, "g.xlsx");
    expect(sheet.headers).toEqual(["Name", "Column B", "Name (2)"]);
  });

  it("caps the number of data rows", () => {
    const aoa: unknown[][] = [["Name"]];
    for (let i = 0; i < MAX_ROWS + 50; i++) aoa.push([`Guest ${i}`]);
    const [sheet] = parseWorkbook(xlsxBuffer({ S: aoa }), "g.xlsx");
    expect(sheet.rows).toHaveLength(MAX_ROWS);
  });

  it("throws a friendly error on an unreadable file", () => {
    expect(() => parseWorkbook(new TextEncoder().encode("\x00\x01\x02"), "x.xlsx")).toThrow(/could not read|no data/i);
  });
});

describe("detectHeaderRow", () => {
  it("skips numeric-only rows and picks the first label row followed by data", () => {
    const m = [
      ["1", "2", "3"],
      ["Name", "Email", "Side"],
      ["A", "a@x.com", "bride"],
    ];
    expect(detectHeaderRow(m)).toBe(1);
  });
  it("falls back to row 0 when nothing looks like a header", () => {
    expect(detectHeaderRow([["1", "2"], ["3", "4"]])).toBe(0);
  });
});

describe("defaultSheetIndex", () => {
  it("prefers the sheet with the most data, not merely the first one", () => {
    const notes = { name: "Notes", headerRow: 0, headers: ["Notes"], rows: [["Call caterer"]] };
    const guests = { name: "Guests", headerRow: 0, headers: ["Name", "Email", "Side"], rows: Array.from({ length: 15 }, (_, i) => [`G${i}`, `g${i}@x.com`, "bride"]) };
    expect(defaultSheetIndex([notes, guests])).toBe(1);
    expect(defaultSheetIndex([guests, notes])).toBe(0);
    expect(defaultSheetIndex([])).toBe(0);
  });
});
