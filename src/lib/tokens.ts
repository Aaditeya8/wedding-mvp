import { randomBytes, createHash } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function tokenExpiry(weddingDate: Date): Date {
  return new Date(weddingDate.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime();
}
