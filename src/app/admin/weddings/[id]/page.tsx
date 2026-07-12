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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400">
            <Link href="/admin" className="underline underline-offset-2">admin</Link> / weddings
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            {wedding.brideName} &amp; {wedding.groomName} · {fmtWeddingDate(wedding.weddingDate)}
          </h1>
        </div>
        <nav className="flex gap-3 text-sm">
          <a href={`/w/${wedding.slug}`} target="_blank" className="text-neutral-600 underline underline-offset-4">
            Site ↗
          </a>
          {/* Admin passes both requireRole gates — visiting these IS the impersonation mechanism */}
          <Link href={`/committee?wedding=${wedding.id}`} className="text-neutral-600 underline underline-offset-4">
            Committee view
          </Link>
          <Link href={`/couple?wedding=${wedding.id}`} className="text-neutral-600 underline underline-offset-4">
            Couple view
          </Link>
        </nav>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => (
          <div key={s.eventId} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.eventName}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.attendingHeadcount}</p>
            <p className="mt-1 text-xs text-neutral-500 tabular-nums">
              {s.responded}/{s.invitedFamilies} answered
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold">Email log</h2>
          {logs.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">No emails sent yet.</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
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
                    <td className="py-2">{famById.get(l.familyId) ?? "—"}</td>
                    <td className="py-2 text-neutral-500">{l.type}</td>
                    <td className="py-2 text-neutral-500">
                      {l.sentAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className={`py-2 text-xs ${l.status === "sent" ? "text-green-700" : "text-red-600"}`}>
                      {l.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold">Staff</h2>
          <ul className="mt-4 space-y-3">
            {staff.map((u) => (
              <li key={u.id} className="text-sm">
                <p className="font-medium">{u.name ?? u.email}</p>
                <p className="text-xs text-neutral-500">{u.email} · {u.role}</p>
              </li>
            ))}
            {staff.length === 0 && <li className="text-sm text-neutral-400">No staff provisioned.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
