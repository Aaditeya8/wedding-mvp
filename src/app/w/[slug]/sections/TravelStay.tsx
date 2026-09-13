import { SectionHeader } from "./SectionHeader";
import type { TravelInfo } from "@/db/schema";

/* Travel copy is prose the couple writes in their editor (weddings.travel). */
export function TravelStay({ travel, no = "03" }: { travel: TravelInfo | null; no?: string }) {
  const stays = travel?.stays ?? [];
  const gettingThere = travel?.gettingThere ?? "";
  if (!stays.length && !gettingThere) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no={no} title="Travel & Stay" />
      {stays.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {stays.map((s, i) => (
            <div
              key={`${s.name}-${i}`}
              className="reveal card-mount p-8"
              data-fx="scale"
              style={{ "--rd": `${i * 0.14}s` } as React.CSSProperties}
            >
              <p className="kicker">Stay</p>
              <h3 className="font-display mt-4 text-2xl md:text-3xl">{s.name}</h3>
              {s.note && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {s.note}
                </p>
              )}
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline underline-offset-4" style={{ color: "var(--accent-2)" }}>
                  Book / directions ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {gettingThere && (
        <p className="reveal mt-10 max-w-2xl whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {gettingThere}
        </p>
      )}
    </section>
  );
}
