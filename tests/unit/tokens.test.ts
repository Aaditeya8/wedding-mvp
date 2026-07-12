import { describe, it, expect } from "vitest";
import { generateInviteToken, hashToken, tokenExpiry, isExpired } from "@/lib/tokens";

describe("invite tokens", () => {
  it("generates 32-byte base64url tokens with matching hash", () => {
    const { token, tokenHash } = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens", () => {
    expect(generateInviteToken().token).not.toBe(generateInviteToken().token);
  });

  it("expiry is wedding date + 7 days", () => {
    const d = tokenExpiry(new Date("2026-11-20T00:00:00Z"));
    expect(d.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("isExpired handles past, future, and null", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    expect(isExpired(new Date("2026-07-11T00:00:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-07-13T00:00:00Z"), now)).toBe(false);
    expect(isExpired(null, now)).toBe(true);
  });
});
