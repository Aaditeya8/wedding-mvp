import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, families, guests, rsvps } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { getRsvpSummary } from "@/lib/rsvp";
import { SummaryCards } from "./SummaryCards";
import { NonResponders } from "./NonResponders";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ShareCard } from "./ShareCard";
import { fmtWeddingDate } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CouplePage({
  searchParams,
}: {
  searchParams: Promise<{ wedding?: string }>;
}) {
  const staff = await requireRole(["couple", "admin"]);
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
  const summary = await getRsvpSummary(weddingId);
  const fams = await db.select().from(families).where(eq(families.weddingId, weddingId)).orderBy(families.createdAt);
  const famIds = fams.map((f) => f.id);
  const [allGuests, allRsvps] = famIds.length
    ? await Promise.all([
        db.select().from(guests).where(inArray(guests.familyId, famIds)),
        db.select().from(rsvps).where(inArray(rsvps.familyId, famIds)),
      ])
    : [[], []];

  const respondedFamilyIds = new Set(allRsvps.map((r) => r.familyId));
  const nonResponders = fams.filter((f) => !respondedFamilyIds.has(f.id));
  const totalAttending = summary.reduce((max, s) => Math.max(max, s.attendingHeadcount), 0);
  const responseRate = fams.length
    ? Math.round((respondedFamilyIds.size / fams.length) * 100)
    : 0;

  const coupleNames = `${wedding.brideName} & ${wedding.groomName}`;
  const bySide = (side: "bride" | "groom" | "both") => fams.filter((f) => f.side === side);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{coupleNames} — your wedding at a glance</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Numbers update the moment a family answers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staff.role === "admin" ? `/couple/site?wedding=${weddingId}` : "/couple/site"} className="portal-button">Edit your site</Link>
          <Link href={staff.role === "admin" ? `/committee?wedding=${weddingId}` : "/committee"} className="portal-button-secondary">Guest list &amp; invites</Link>
        </div>
      </header>

      <div className="mb-6">
        <ShareCard slug={wedding.slug} coupleNames={coupleNames} weddingDateText={fmtWeddingDate(wedding.weddingDate)} />
      </div>

      {/* headline stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:max-w-md">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Peak attendance</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{totalAttending}</p>
          <p className="mt-1 text-xs text-neutral-500">largest single event</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Response rate</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{responseRate}%</p>
          <p className="mt-1 text-xs text-neutral-500">{respondedFamilyIds.size} of {fams.length} families</p>
        </div>
      </div>

      <div className="mb-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mb-6">
        <ThemeSwitcher
          weddingId={weddingId}
          current={wedding.theme}
          slug={wedding.slug}
          coupleNames={coupleNames}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NonResponders
          families={nonResponders.map((f) => ({ id: f.id, name: f.name, relation: f.relation, side: f.side }))}
        />

        {/* read-only guest list grouped by side */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold">Guest list</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add families, import a spreadsheet or send invites in the <Link href="/committee" className="underline">guest list</Link>.
          </p>
          <div className="mt-4 space-y-5">
            {(["bride", "groom", "both"] as const).map((side) => {
              const group = bySide(side);
              if (!group.length) return null;
              return (
                <div key={side}>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {side === "both" ? "Shared friends" : `${side}'s side`}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {group.map((f) => (
                      <li key={f.id} className="text-sm">
                        <span className="font-medium">{f.name}</span>
                        <span className="text-neutral-500">
                          {" "}— {allGuests.filter((g) => g.familyId === f.id).map((g) => g.fullName.split(" ")[0]).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
