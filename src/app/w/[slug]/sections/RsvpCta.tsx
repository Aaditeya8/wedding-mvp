import { fmtWeddingDate } from "@/lib/format";

export function RsvpCta({
  slug, open, deadline, contactPhone,
}: { slug: string; open: boolean; deadline: Date | null; contactPhone: string | null }) {
  return (
    <>
      {/* gota-style scalloped edge eases the jump into the full-bleed band */}
      <div className="scallop" aria-hidden />
      <section
        id="rsvp"
        className="px-6 py-24 text-center md:py-32"
        style={{ background: "var(--band-bg)", color: "var(--band-ink)" }}
      >
        <p className="kicker reveal foil">RSVP</p>
        {open ? (
          <>
            <h2 className="font-display reveal mx-auto mt-6 max-w-3xl text-4xl tracking-tight md:text-6xl">
              Will you be joining us?
            </h2>
            <p
              className="reveal mx-auto mt-8 max-w-xl text-sm leading-relaxed opacity-75"
              style={{ "--rd": "0.15s" } as React.CSSProperties}
            >
              Tell us which celebrations you can make and how many of you are coming.
              No app, no account — half a minute on your phone.
              {deadline ? ` Kindly reply by ${fmtWeddingDate(deadline)}.` : ""}
            </p>
            <a
              href={`/w/${slug}/rsvp`}
              className="reveal mt-10 inline-block px-10 py-4 text-sm uppercase tracking-[0.2em] transition-opacity hover:opacity-90"
              style={{ background: "var(--band-ink)", color: "var(--band-bg)", "--rd": "0.25s" } as React.CSSProperties}
            >
              RSVP now
            </a>
          </>
        ) : (
          <>
            <h2 className="font-display reveal mx-auto mt-6 max-w-3xl text-4xl tracking-tight md:text-6xl">
              RSVPs are closed — but we&apos;d still love to hear from you.
            </h2>
            <p className="reveal mx-auto mt-8 max-w-xl text-sm leading-relaxed opacity-75">
              {contactPhone ? `Message the family on ${contactPhone} and we'll make room.` : "Reach out to the family directly and we'll make room."}
            </p>
          </>
        )}
      </section>
    </>
  );
}
