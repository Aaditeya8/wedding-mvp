import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, families, users, emailLog } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { getRsvpSummary } from "@/lib/rsvp";
import { fmtWeddingDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminWeddingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;

  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, id));
  if (!wedding) notFound();

  const summary = await getRsvpSummary(id);
  const fams = await db.select().from(families).where(eq(families.weddingId, id));
  const famById = new Map(fams.map((f) => [f.id, f.name]));
  const famIds = fams.map((f) => f.id);
  const logs = famIds.length
    ? await db.select().from(emailLog).where(inArray(emailLog.familyId, famIds)).orderBy(desc(emailLog.sentAt)).limit(100)
    : [];
  const staff = await db.select().from(users).where(eq(users.weddingId, id));

  return (
    <main className="portal-page">
      <div className="portal-shell">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="max-w-2xl">
          <p className="portal-eyebrow">
            <Link href="/admin" className="hover:text-stone-950">Platform control room</Link> <span className="mx-1 text-stone-300">/</span> wedding detail
          </p>
          <h1 className="portal-heading mt-2">
            {wedding.brideName} &amp; {wedding.groomName} · {fmtWeddingDate(wedding.weddingDate)}
          </h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          <a href={`/w/${wedding.slug}`} target="_blank" rel="noreferrer" className="portal-button-secondary">
            Site ↗
          </a>
          {/* Admin passes both requireRole gates — visiting these IS the impersonation mechanism */}
          <Link href={`/committee?wedding=${wedding.id}`} className="portal-button-secondary">
            Committee view
          </Link>
          <Link href={`/couple?wedding=${wedding.id}`} className="portal-button-secondary">
            Couple view
          </Link>
        </nav>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => (
          <div key={s.eventId} className="portal-panel portal-stat">
            <p className="portal-stat-label">{s.eventName}</p>
            <p className="portal-stat-value tabular-nums">{s.attendingHeadcount}</p>
            <p className="portal-stat-note tabular-nums">
              {s.responded}/{s.invitedFamilies} answered
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="portal-panel md:col-span-2">
          <div className="border-b border-stone-100 px-6 py-5">
            <p className="portal-eyebrow">Delivery</p>
            <h2 className="mt-1 font-semibold">Email log</h2>
          </div>
          {logs.length === 0 ? (
            <p className="px-6 py-10 text-sm text-neutral-400">No emails sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="portal-table w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2">Family</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Sent</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((l) => (
                  <tr key={l.id} className={l.status !== "sent" ? "bg-red-50" : undefined}>
                    <td>{famById.get(l.familyId) ?? "—"}</td>
                    <td className="text-neutral-500">{l.type}</td>
                    <td className="text-neutral-500">
                      {l.sentAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className={`text-xs font-medium ${l.status === "sent" ? "text-green-700" : "text-red-600"}`}>
                      {l.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>

        <section className="portal-panel p-6">
          <p className="portal-eyebrow">Access</p>
          <h2 className="mt-1 font-semibold">Staff</h2>
          <ul className="mt-5 space-y-4">
            {staff.map((u) => (
              <li key={u.id} className="border-b border-stone-100 pb-4 text-sm last:border-0 last:pb-0">
                <p className="font-medium">{u.name ?? u.email}</p>
                <p className="mt-1 text-xs text-neutral-500">{u.email}</p>
                <span className="portal-badge mt-2">{u.role}</span>
              </li>
            ))}
            {staff.length === 0 && <li className="text-sm text-neutral-400">No staff provisioned.</li>}
          </ul>
        </section>
      </div>
      </div>
    </main>
  );
}
