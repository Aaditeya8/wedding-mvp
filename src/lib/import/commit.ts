import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, families, guests, eventInvites } from "@/db/schema";
import type { ImportRow } from "./normalize";

export type CommitOptions = { onExisting: "skip" | "update" };
export type CommitResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { key: string; error: string }[];
};

/** lower-cased email → familyId, for this wedding only */
export async function findExistingEmails(weddingId: string): Promise<Map<string, string>> {
  const rows = await db.select({ id: families.id, email: families.email }).from(families).where(eq(families.weddingId, weddingId));
  const map = new Map<string, string>();
  for (const r of rows) {
    const e = r.email.trim().toLowerCase();
    if (e && !map.has(e)) map.set(e, r.id);
  }
  return map;
}

/**
 * Write reviewed households. Sequential, not transactional (neon-http has no
 * interactive transactions): a bad row is reported and the rest still land, which
 * matches how the committee thinks about a list — fix the two odd ones, move on.
 */
export async function commitImport(weddingId: string, rows: ImportRow[], opts: CommitOptions): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const validEvents = new Set((await db.select({ id: events.id }).from(events).where(eq(events.weddingId, weddingId))).map((e) => e.id));
  const existing = await findExistingEmails(weddingId);

  for (const row of rows) {
    const name = row.name.trim();
    const email = row.email.trim().toLowerCase();
    if (!name) { result.errors.push({ key: row.key, error: "household name is required" }); continue; }
    if (!row.eventIds.every((id) => validEvents.has(id))) { result.errors.push({ key: row.key, error: "invited to an event that isn't part of this wedding" }); continue; }
    const members = row.members.map((m) => ({ fullName: m.fullName.trim(), ageGroup: m.ageGroup })).filter((m) => m.fullName);
    if (!members.length) { result.errors.push({ key: row.key, error: "at least one member is required" }); continue; }

    const values = { name, side: row.side, relation: row.relation.trim() || null, email };
    const existingId = email ? existing.get(email) : undefined;

    let familyId: string;
    if (existingId) {
      if (opts.onExisting === "skip") { result.skipped++; continue; }
      await db.update(families).set(values).where(eq(families.id, existingId));
      await db.delete(guests).where(eq(guests.familyId, existingId));
      await db.delete(eventInvites).where(eq(eventInvites.familyId, existingId));
      familyId = existingId;
      result.updated++;
    } else {
      const [f] = await db.insert(families).values({ weddingId, ...values }).returning({ id: families.id });
      familyId = f.id;
      if (email) existing.set(email, familyId);
      result.created++;
    }

    await db.insert(guests).values(members.map((m) => ({ familyId, ...m })));
    if (row.eventIds.length) {
      await db.insert(eventInvites).values(row.eventIds.map((eventId) => ({ eventId, familyId })));
    }
  }
  return result;
}
