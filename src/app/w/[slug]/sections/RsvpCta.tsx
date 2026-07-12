export function RsvpCta({ theme: _theme }: { theme: string }) {
  return (
    <section
      className="px-6 py-24 text-center md:py-32"
      style={{ background: "var(--band-bg)", color: "var(--band-ink)" }}
    >
      <p className="kicker reveal" style={{ color: "var(--accent)" }}>
        RSVP
      </p>
      <h2 className="font-display reveal mx-auto mt-6 max-w-3xl text-4xl tracking-tight md:text-6xl">
        Got your invite email? Your RSVP link is inside.
      </h2>
      <p className="reveal mx-auto mt-8 max-w-xl text-sm leading-relaxed opacity-75">
        Every family gets a personal link — no accounts, no passwords, and you can
        change your answer any time from the same link. Can&apos;t find yours? Ask the
        family to resend it.
      </p>
    </section>
  );
}
