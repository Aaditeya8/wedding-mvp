import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { events, families, guests, eventInvites } from "@/db/schema";
import type { ImportRow, Member } from "./normalize";
import { matchExisting, normalizePersonName, type ExistingFamily } from "./match";

export type CommitOptions = { onExisting: "skip" | "update" | "merge" };
export type CommitResult = {
  created: number;
  /** updated + merged */
  updated: number;
  skipped: number;
  errors: { key: string; error: string }[];
};

/** Everything duplicate detection needs about the households already on the list. */
export async function findExistingFamilies(weddingId: string): Promise<ExistingFamily[]> {
  const fams = await db.select({ id: families.id, name: families.name, email: families.email })
    .from(families).where(eq(families.weddingId, weddingId));
  if (!fams.length) return [];
  const members = await db.select({ familyId: guests.familyId, fullName: guests.fullName })
    .from(guests).where(inArray(guests.familyId, fams.map((f) => f.id)));
  return fams.map((f) => ({
    id: f.id, name: f.name, email: f.email,
    members: members.filter((m) => m.familyId === f.id).map((m) => m.fullName),
  }));
}

/** lower-cased email → familyId, for this wedding only */
export async function findExistingEmails(weddingId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const f of await findExistingFamilies(weddingId)) {
    const e = f.email.trim().toLowerCase();
    if (e && !map.has(e)) map.set(e, f.id);
  }
  return map;
}

const isPlaceholder = (m: Member) => normalizePersonName(m.fullName) === null;

/**
 * Write reviewed households. Sequential, not transactional (neon-http has no
 * interactive transactions): a bad row is reported and the rest still land, which
 * matches how the committee thinks about a list — fix the two odd ones, move on.
 *
 * A row that matches a household already on the list (email, name, or the same
 * people) is skipped, replaced, or merged according to `onExisting`. Merge is the
 * incremental mode: new people and events are added, blanks filled, nothing removed.
 */
export async function commitImport(weddingId: string, rows: ImportRow[], opts: CommitOptions): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const validEvents = new Set((await db.select({ id: events.id }).from(events).where(eq(events.weddingId, weddingId))).map((e) => e.id));
  const existing = await findExistingFamilies(weddingId);

  for (const row of rows) {
    const name = row.name.trim();
    const email = row.email.trim().toLowerCase();
    if (!name) { result.errors.push({ key: row.key, error: "household name is required" }); continue; }
    if (!row.eventIds.every((id) => validEvents.has(id))) { result.errors.push({ key: row.key, error: "invited to an event that isn't part of this wedding" }); continue; }
    const members = row.members.map((m) => ({ fullName: m.fullName.trim(), ageGroup: m.ageGroup })).filter((m) => m.fullName);
    if (!members.length) { result.errors.push({ key: row.key, error: "at least one member is required" }); continue; }

    const relation = row.relation.trim() || null;
    const match = matchExisting(row, existing);

    if (match && opts.onExisting === "skip") { result.skipped++; continue; }

    if (match && opts.onExisting === "merge") {
      const ex = existing.find((f) => f.id === match.id)!;
      const [current] = await db.select().from(families).where(eq(families.id, ex.id));
      await db.update(families).set({
        relation: current.relation ?? relation,
        email: current.email.trim() ? current.email : email,
      }).where(eq(families.id, ex.id));

      const have = new Set(ex.members.map(normalizePersonName).filter((n): n is string => !!n));
      const fresh = members.filter((m) => !isPlaceholder(m) && !have.has(normalizePersonName(m.fullName)!));
      if (fresh.length) {
        await db.insert(guests).values(fresh.map((m) => ({ familyId: ex.id, ...m })));
        ex.members.push(...fresh.map((m) => m.fullName));
      }

      const invited = new Set((await db.select({ eventId: eventInvites.eventId }).from(eventInvites).where(eq(eventInvites.familyId, ex.id))).map((i) => i.eventId));
      const newEvents = row.eventIds.filter((id) => !invited.has(id));
      if (newEvents.length) await db.insert(eventInvites).values(newEvents.map((eventId) => ({ eventId, familyId: ex.id })));

      if (!ex.email && email) ex.email = email;
      result.updated++;
      continue;
    }

    let familyId: string;
    if (match) {
      // update: this version wins, but never blank out an email we already have
      const ex = existing.find((f) => f.id === match.id)!;
      await db.update(families).set({ name, side: row.side, relation, email: email || ex.email })
        .where(eq(families.id, ex.id));
      await db.delete(guests).where(eq(guests.familyId, ex.id));
      await db.delete(eventInvites).where(eq(eventInvites.familyId, ex.id));
      familyId = ex.id;
      ex.name = name; ex.email = email || ex.email; ex.members = members.map((m) => m.fullName);
      result.updated++;
    } else {
      const [f] = await db.insert(families).values({ weddingId, name, side: row.side, relation, email }).returning();
      familyId = f.id;
      existing.push({ id: f.id, name, email, members: members.map((m) => m.fullName) });
      result.created++;
    }

    await db.insert(guests).values(members.map((m) => ({ familyId, ...m })));
    if (row.eventIds.length) {
      await db.insert(eventInvites).values(row.eventIds.map((eventId) => ({ eventId, familyId })));
    }
  }
  return result;
}
