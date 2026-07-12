import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps, emailLog } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { getRsvpSummary } from "@/lib/rsvp";
import { FamilyTable } from "./FamilyTable";

export const dynamic = "force-dynamic";

export default async function CommitteePage({
  searchParams,
}: {
  searchParams: Promise<{ wedding?: string }>;
}) {
  const staff = await requireRole(["committee", "admin"]);
  const requested = (await searchParams).wedding;
  let weddingId = staff.role === "admin" ? (requested ?? null) : staff.weddingId;
  if (staff.role === "admin" && !weddingId) {
    const [first] = await db.select().from(weddings).limit(1);
    weddingId = first?.id ?? null;
  }
  if (!weddingId) {
    return <main className="p-10 text-sm text-neutral-500">No wedding assigned to this account.</main>;
  }

  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
  const evs = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
  const summary = await getRsvpSummary(weddingId);
  const fams = await db.select().from(families).where(eq(families.weddingId, weddingId)).orderBy(families.createdAt);
  const famIds = fams.map((f) => f.id);
  const [allGuests, allInvites, allRsvps, allLogs] = famIds.length
    ? await Promise.all([
        db.select().from(guests).where(inArray(guests.familyId, famIds)),
        db.select().from(eventInvites).where(inArray(eventInvites.familyId, famIds)),
        db.select().from(rsvps).where(inArray(rsvps.familyId, famIds)),
        db.select().from(emailLog).where(inArray(emailLog.familyId, famIds)).orderBy(desc(emailLog.sentAt)),
      ])
    : [[], [], [], []];

  const rows = fams.map((f) => ({
    id: f.id,
    name: f.name,
    side: f.side,
    relation: f.relation,
    email: f.email,
    members: allGuests.filter((g) => g.familyId === f.id)
      .map((g) => ({ fullName: g.fullName, ageGroup: g.ageGroup })),
    eventIds: allInvites.filter((i) => i.familyId === f.id).map((i) => i.eventId),
    rsvpByEvent: Object.fromEntries(
      allRsvps.filter((r) => r.familyId === f.id)
        .map((r) => [r.eventId, { status: r.status, headcount: r.headcount, note: r.note }]),
    ) as Record<string, { status: "attending" | "declined"; headcount: number; note: string | null }>,
    lastEmail: (() => {
      const l = allLogs.find((x) => x.familyId === f.id);
      return l ? { type: l.type, status: l.status, sentAt: l.sentAt.toISOString() } : null;
    })(),
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Committee — {wedding.brideName} &amp; {wedding.groomName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Guest list, invites and headcounts. The couple sees totals; you see everything.
          </p>
        </div>
        <a href={`/w/${wedding.slug}`} className="text-sm text-neutral-600 underline underline-offset-4">
          View wedding site ↗
        </a>
      </header>

      {/* per-event summary strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => (
          <div key={s.eventId} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.eventName}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.attendingHeadcount}</p>
            <p className="mt-1 text-xs text-neutral-500 tabular-nums">
              attending · {s.responded}/{s.invitedFamilies} families answered
            </p>
          </div>
        ))}
      </div>

      <FamilyTable
        weddingId={weddingId}
        events={evs.map((e) => ({ id: e.id, name: e.name }))}
        rows={rows}
      />
    </main>
  );
}
