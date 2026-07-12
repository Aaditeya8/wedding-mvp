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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">Admin — weddings</h1>
        <p className="mt-1 text-sm text-neutral-500">Every wedding on the platform.</p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No weddings yet. Creation UI is production scope — for the demo, run{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run seed</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Couple</th>
                <th className="p-3">Date</th>
                <th className="p-3">Theme</th>
                <th className="p-3">Families</th>
                <th className="p-3">Responded</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium">{w.brideName} &amp; {w.groomName}</p>
                    <p className="text-xs text-neutral-500">/{w.slug}</p>
                  </td>
                  <td className="p-3">{fmtWeddingDate(w.weddingDate)}</td>
                  <td className="p-3">
                    <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs">
                      {w.theme}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{w.familyCount}</td>
                  <td className="p-3 tabular-nums">{w.responded}/{w.familyCount}</td>
                  <td className="p-3 text-right text-xs">
                    <a href={`/w/${w.slug}`} target="_blank" className="text-neutral-500 underline underline-offset-2">
                      site ↗
                    </a>
                    <Link href={`/admin/weddings/${w.id}`} className="ml-3 text-neutral-900 underline underline-offset-2">
                      manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
