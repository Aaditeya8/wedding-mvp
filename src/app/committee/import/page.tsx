import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { aiConfigured } from "@/lib/ai";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ wedding?: string; mode?: string }>;
}) {
  const staff = await requireRole(["committee", "admin"]);
  const params = await searchParams;
  let weddingId = staff.role === "admin" ? (params.wedding ?? null) : staff.weddingId;
  if (staff.role === "admin" && !weddingId) {
    const [first] = await db.select().from(weddings).limit(1);
    weddingId = first?.id ?? null;
  }
  if (!weddingId) {
    return <main className="p-10 text-sm text-neutral-500">No wedding assigned to this account.</main>;
  }

  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
  const evs = await db.select({ id: events.id, name: events.name, sortOrder: events.sortOrder })
    .from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);

  const backHref = staff.role === "admin" ? `/committee?wedding=${weddingId}` : "/committee";

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
          <div className="max-w-2xl">
            <p className="portal-eyebrow">Guest intake</p>
            <h1 className="portal-heading mt-2">{wedding.brideName} &amp; {wedding.groomName}</h1>
            <p className="portal-subheading mt-3">
              Bring the guest list in whatever shape it arrives: a spreadsheet, a photo of a handwritten list, a document, a pasted message, or typed straight in. You review every line before anything is saved, and households already on the list are merged rather than duplicated.
            </p>
          </div>
          <Link href={backHref} className="portal-button-secondary">← Guest operations</Link>
        </header>

        <ImportWizard
          weddingId={weddingId}
          events={evs}
          backHref={backHref}
          initialMode={params.mode === "direct" ? "direct" : params.mode === "scan" ? "scan" : null}
          aiConfigured={aiConfigured()}
        />
      </div>
    </main>
  );
}
