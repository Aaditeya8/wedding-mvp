import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicWedding, rsvpWindow } from "@/lib/open-rsvp";
import { fmtWeddingDate } from "@/lib/format";
import { Ornament } from "@/themes/ornaments";
import { OpenRsvpForm } from "./OpenRsvpForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getPublicWedding((await params).slug);
  return { title: data ? `RSVP · ${data.wedding.brideName} & ${data.wedding.groomName}` : "RSVP", robots: { index: false } };
}

export default async function OpenRsvpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicWedding(slug);
  if (!data) notFound();
  const { wedding, events } = data;
  const window = rsvpWindow(wedding);
  const coupleNames = `${wedding.brideName} & ${wedding.groomName}`;

  return (
    <main data-theme={wedding.theme} className="themed min-h-svh px-6 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <Link href={`/w/${slug}`} className="kicker rise rise-1 inline-block underline-offset-4 hover:underline">
            ← {coupleNames} · {fmtWeddingDate(wedding.weddingDate)}
          </Link>
          <h1
            className="font-display rise rise-2 mt-6 tracking-tight"
            style={{ fontSize: "clamp(2.6rem, 8vw, 4.5rem)", lineHeight: 1.02 }}
          >
            {window.open ? "Will you be joining us?" : "RSVPs are closed"}
          </h1>
          <p className="rise rise-3 mt-6 text-base md:text-lg" style={{ color: "var(--ink-soft)" }}>
            {window.open
              ? "Tell us who's coming and to which celebrations. It takes half a minute, and you can change your answer later."
              : wedding.contactPhone
                ? `Reach the family on ${wedding.contactPhone} — we'll make room.`
                : "Reach out to the family directly — we'll make room."}
          </p>
          <div className="rise rise-3 mt-8">
            <Ornament theme={wedding.theme} slot="hero" />
          </div>
        </header>

        {window.open && events.length > 0 && (
          <OpenRsvpForm
            slug={slug}
            events={events.map((e) => ({
              id: e.id, name: e.name, startsAtISO: e.startsAt.toISOString(),
              venueName: e.venueName, address: e.address, dressCode: e.dressCode,
            }))}
          />
        )}
        {window.open && events.length === 0 && (
          <p className="mt-12 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
            The celebrations haven&apos;t been announced yet — check back soon.
          </p>
        )}
      </div>
    </main>
  );
}
