import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, families, eventInvites, rsvps } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { sendInvite } from "@/lib/mailer";
import { appOrigin } from "@/lib/origin";

export type InviteType = "invite" | "resend" | "remind";

export type IssueResult = { familyId: string; ok: boolean; error?: string };

// Hash-only token storage means every send mints a fresh link — we cannot
// recover the original token to re-use it for reminders. Acceptable: the old
// link works only until this overwrite, and each mail carries a working one.
export async function issueInvites(
  weddingId: string,
  familyIds: string[],
  type: InviteType,
): Promise<IssueResult[]> {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
  if (!wedding) return familyIds.map((familyId) => ({ familyId, ok: false, error: "wedding not found" }));
  const coupleNames = `${wedding.brideName} & ${wedding.groomName}`;
  const appUrl = await appOrigin();

  const results: IssueResult[] = [];
  for (const familyId of familyIds) {
    const [family] = await db.select().from(families)
      .where(and(eq(families.id, familyId), eq(families.weddingId, weddingId)));
    if (!family) {
      results.push({ familyId, ok: false, error: "family not in wedding" });
      continue;
    }
    // Imported households may arrive without an email (WhatsApp-only lists);
    // nothing to send to until the committee adds one.
    if (!family.email.trim()) {
      results.push({ familyId, ok: false, error: "no email" });
      continue;
    }

    if (type === "remind") {
      const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, familyId));
      const responses = await db.select().from(rsvps).where(eq(rsvps.familyId, familyId));
      const respondedIds = new Set(responses.map((r) => r.eventId));
      if (invites.length > 0 && invites.every((i) => respondedIds.has(i.eventId))) {
        results.push({ familyId, ok: false, error: "already responded" });
        continue;
      }
    }

    const { token, tokenHash } = generateInviteToken();
    await db.update(families)
      .set({ inviteTokenHash: tokenHash, tokenExpiresAt: tokenExpiry(wedding.weddingDate) })
      .where(eq(families.id, familyId));

    const res = await sendInvite({
      familyId,
      to: family.email,
      familyName: family.name,
      coupleNames,
      rsvpUrl: `${appUrl}/rsvp/${token}`,
      theme: wedding.theme,
      type: type === "remind" ? "reminder" : type,
    });
    results.push(res.ok ? { familyId, ok: true } : { familyId, ok: false, error: res.error });
  }
  return results;
}
