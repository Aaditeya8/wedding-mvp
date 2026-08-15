import { Ornament } from "@/themes/ornaments";
import { fmtWeddingDate } from "@/lib/format";
import { Petals } from "./Petals";
import { Countdown } from "./Countdown";

type HeroWedding = {
  brideName: string;
  groomName: string;
  theme: string;
  weddingDate: Date;
  heroTagline: string | null;
};

/* Letter-by-letter reveal; --i continues across both names so the cascade
   reads as one gesture. The intact word stays available to screen readers. */
function Letters({ text, from }: { text: string; from: number }) {
  return (
    <span aria-label={text} role="text">
      {text.split("").map((ch, i) => (
        <span key={i} aria-hidden className="ltr" style={{ "--i": from + i } as React.CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export function Hero({ wedding, city }: { wedding: HeroWedding; city?: string }) {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <Petals />

      {/* watermark ampersand, drifts on scroll via --py from ScrollFx */}
      <span
        aria-hidden
        className="font-display parallax pointer-events-none absolute left-1/2 top-1/2 select-none italic leading-none"
        style={{ fontSize: "min(72vw, 820px)", color: "var(--ink)", opacity: 0.045 }}
      >
        &amp;
      </span>

      <p className="kicker rise rise-1">The wedding of</p>

      <h1
        className="font-display mt-6 tracking-tight"
        style={{ fontSize: "clamp(3.75rem, 14vw, 10.5rem)", lineHeight: 0.95 }}
      >
        <Letters text={wedding.brideName} from={0} />
        <br />
        <em
          className="foil ltr italic"
          style={{ "--i": wedding.brideName.length + 1 } as React.CSSProperties}
        >
          &amp;
        </em>{" "}
        <Letters text={wedding.groomName} from={wedding.brideName.length + 3} />
      </h1>

      <div className="rise rise-3 mt-10">
        <Ornament theme={wedding.theme} slot="hero" anim="load" />
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
        {fmtWeddingDate(wedding.weddingDate)}{city ? ` · ${city}` : ""}
      </p>

      <div className="rise rise-4 mt-8">
        <Countdown date={wedding.weddingDate} />
      </div>

      <span aria-hidden className="scroll-cue absolute bottom-8" />
    </section>
  );
}
