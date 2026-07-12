import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rateLimit", () => {
  it("allows up to max hits then blocks within the window", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("k1", { max: 5 })).toBe(true);
    expect(rateLimit("k1", { max: 5 })).toBe(false);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("k2", { max: 1 })).toBe(true);
    expect(rateLimit("k3", { max: 1 })).toBe(true);
  });
});
