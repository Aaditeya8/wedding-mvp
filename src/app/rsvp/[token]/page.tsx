import type { Metadata } from "next";
import { getFamilyByToken } from "@/lib/rsvp";
import { fmtWeddingDate } from "@/lib/format";
import { Ornament } from "@/themes/ornaments";
import { RsvpForm } from "./RsvpForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "RSVP", robots: { index: false } };

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getFamilyByToken(token);

  if (!data) {
    return (
      <main
        data-theme="ivory-editorial"
        className="themed flex min-h-svh flex-col items-center justify-center px-6 text-center"
      >
        <p className="kicker">RSVP</p>
        <h1 className="font-display mt-6 max-w-xl text-4xl tracking-tight md:text-5xl">
          This link has wandered off the guest list.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          It may have expired or been replaced with a fresh one. Ask the family to
          resend your invitation — the newest email always carries a working link.
        </p>
      </main>
    );
  }

  const { family, wedding, members, events } = data;
  const coupleNames = `${wedding.brideName} & ${wedding.groomName}`;

  return (
    <main data-theme={wedding.theme} className="themed min-h-svh px-6 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="kicker rise rise-1">{coupleNames} · {fmtWeddingDate(wedding.weddingDate)}</p>
          <h1
            className="font-display rise rise-2 mt-6 tracking-tight"
            style={{ fontSize: "clamp(2.6rem, 8vw, 4.5rem)", lineHeight: 1.02 }}
          >
            Dear {family.name},
          </h1>
          <p className="rise rise-3 mt-6 text-base md:text-lg" style={{ color: "var(--ink-soft)" }}>
            We would be honoured to have you with us. Tell us who&apos;s coming —
            it takes half a minute.
          </p>
          <div className="rise rise-3 mt-8">
            <Ornament theme={wedding.theme} slot="hero" />
          </div>
        </header>

        <RsvpForm
          token={token}
          memberCount={members.length}
          events={events.map((e) => ({
            id: e.id,
            name: e.name,
            startsAtISO: e.startsAt.toISOString(),
            venueName: e.venueName,
            address: e.address,
            dressCode: e.dressCode,
            rsvp: e.rsvp,
          }))}
        />
      </div>
    </main>
  );
}
