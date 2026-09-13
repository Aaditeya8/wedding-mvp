import { describe, it, expect } from "vitest";
import { EVENT_PRESETS, presetStart, starterEvents } from "@/lib/presets";
import { slugify, uniqueSlug, normalizePhone } from "@/lib/slug";

describe("presets", () => {
  it("starter set is the classic five in order", () => {
    expect(starterEvents(new Date("2026-11-20T10:00:00+05:30"), "Mumbai").map((e) => e.name))
      .toEqual(["Haldi", "Mehendi", "Sangeet", "Pheras", "Reception"]);
  });
  it("presetStart lands on the right IST day and hour", () => {
    const d = presetStart({ dayOffset: -2, hour: 16 }, new Date("2026-11-20T10:00:00+05:30"));
    expect(d.toISOString()).toBe("2026-11-18T10:30:00.000Z"); // 16:00 IST
  });
  it("every preset has a blurb and dress code", () => {
    for (const p of EVENT_PRESETS) { expect(p.blurb.length).toBeGreaterThan(10); expect(p.dressCode).toBeTruthy(); }
  });
});

describe("slug", () => {
  it("slugifies names", () => {
    expect(slugify("Ananya", "weds", "Arjun")).toBe("ananya-weds-arjun");
    expect(slugify("Priyanka  Chopra-Jonas", "weds", "Nick!")).toBe("priyanka-chopra-jonas-weds-nick");
    expect(slugify("")).toBe("wedding");
  });
  it("suffixes until free", async () => {
    const taken = new Set(["a-weds-b", "a-weds-b-2"]);
    expect(await uniqueSlug("a-weds-b", async (s) => taken.has(s))).toBe("a-weds-b-3");
    expect(await uniqueSlug("x", async () => false)).toBe("x");
  });
  it("normalises Indian phones", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("098765-43210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
