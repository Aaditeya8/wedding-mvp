import { Ornament } from "@/themes/ornaments";
import { fmtWeddingDate } from "@/lib/format";

type HeroWedding = {
  brideName: string;
  groomName: string;
  theme: string;
  weddingDate: Date;
  heroTagline: string | null;
};

export function Hero({ wedding }: { wedding: HeroWedding }) {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* watermark ampersand */}
      <span
        aria-hidden
        className="font-display pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none italic leading-none"
        style={{ fontSize: "min(72vw, 820px)", color: "var(--ink)", opacity: 0.045 }}
      >
        &amp;
      </span>

      <p className="kicker rise rise-1">The wedding of</p>

      <h1
        className="font-display rise rise-2 mt-6 tracking-tight"
        style={{ fontSize: "clamp(3.75rem, 14vw, 10.5rem)", lineHeight: 0.95 }}
      >
        {wedding.brideName}
        <br />
        <em className="italic" style={{ color: "var(--accent)" }}>
          &amp;
        </em>{" "}
        {wedding.groomName}
      </h1>

      <div className="rise rise-3 mt-10">
        <Ornament theme={wedding.theme} slot="hero" />
      </div>

      {wedding.heroTagline && (
        <p
          className="rise rise-3 mt-8 max-w-md text-base md:text-lg"
          style={{ color: "var(--ink-soft)" }}
        >
          {wedding.heroTagline}
        </p>
      )}

      <p className="kicker rise rise-4 mt-10">
        {fmtWeddingDate(wedding.weddingDate)} · Mumbai
      </p>

      <p className="kicker rise rise-4 absolute bottom-8" style={{ letterSpacing: "0.3em" }}>
        Scroll
      </p>
    </section>
  );
}
