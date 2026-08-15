import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, families, rsvps } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { fmtWeddingDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(["admin"]);

  const allWeddings = await db.select().from(weddings).orderBy(weddings.createdAt);
  const rows = await Promise.all(
    allWeddings.map(async (w) => {
      const fams = await db.select().from(families).where(eq(families.weddingId, w.id));
      const famIds = fams.map((f) => f.id);
      const responded = famIds.length
        ? new Set((await db.select().from(rsvps).where(inArray(rsvps.familyId, famIds))).map((r) => r.familyId)).size
        : 0;
      return { ...w, familyCount: fams.length, responded };
    }),
  );
  const familyCount = rows.reduce((total, wedding) => total + wedding.familyCount, 0);
  const responded = rows.reduce((total, wedding) => total + wedding.responded, 0);

  return (
    <main className="portal-page">
      <div className="portal-shell">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="portal-eyebrow">Platform control room</p>
          <h1 className="portal-heading mt-2">Wedding operations</h1>
          <p className="portal-subheading mt-3">A concise view of every event, its guest list, and the response progress behind it.</p>
        </div>
        <Link href="/admin/mailroom" className="portal-button-secondary">Mailroom →</Link>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="portal-panel portal-stat">
          <p className="portal-stat-label">Weddings</p>
          <p className="portal-stat-value tabular-nums">{rows.length}</p>
          <p className="portal-stat-note">active workspace{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="portal-panel portal-stat">
          <p className="portal-stat-label">Families</p>
          <p className="portal-stat-value tabular-nums">{familyCount}</p>
          <p className="portal-stat-note">guest households in the system</p>
        </div>
        <div className="portal-panel portal-stat">
          <p className="portal-stat-label">Responses</p>
          <p className="portal-stat-value tabular-nums">{responded}/{familyCount}</p>
          <p className="portal-stat-note">families with an RSVP recorded</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="portal-panel border-dashed p-10 text-center text-sm text-neutral-500">
          No weddings yet. Creation UI is production scope — for the demo, run{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run seed</code>.
        </div>
      ) : (
        <div className="portal-panel overflow-x-auto">
          <table className="portal-table w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Couple</th>
                <th className="p-3">Date</th>
                <th className="p-3">Theme</th>
                <th className="p-3">Families</th>
                <th className="p-3">Responded</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <p className="font-medium">{w.brideName} &amp; {w.groomName}</p>
                    <p className="mt-1 text-xs text-neutral-500">/{w.slug}</p>
                  </td>
                  <td>{fmtWeddingDate(w.weddingDate)}</td>
                  <td>
                    <span className="portal-badge">
                      {w.theme}
                    </span>
                  </td>
                  <td className="tabular-nums">{w.familyCount}</td>
                  <td className="tabular-nums">{w.responded}/{w.familyCount}</td>
                  <td className="text-right">
                    <a href={`/w/${w.slug}`} target="_blank" className="portal-link">
                      site ↗
                    </a>
                    <Link href={`/admin/weddings/${w.id}`} className="portal-link ml-4">
                      manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </main>
  );
}
