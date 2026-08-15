import { SectionHeader } from "./SectionHeader";
import { fmtEventDate, fmtEventTime } from "@/lib/format";

type EventRow = {
  id: string;
  name: string;
  startsAt: Date;
  venueName: string;
  address: string;
  mapUrl: string | null;
  dressCode: string | null;
};

export function EventTimeline({ theme: _theme, events }: { theme: string; events: EventRow[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no="02" title="The Celebrations" />
      <ol>
        {events.map((e, i) => (
          <li
            key={e.id}
            /* first row skips its rule: the header's taper already closes that gap */
            className={`reveal grid gap-4 py-10 md:grid-cols-12 md:gap-8 ${i > 0 ? "rule-grow" : ""}`}
            style={{ "--rd": `${(i % 3) * 0.12}s` } as React.CSSProperties}
          >
            <span
              className="font-display text-2xl md:col-span-1 md:text-3xl"
              style={{ color: "var(--ink-soft)", opacity: 0.55 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="md:col-span-6">
              <h3 className="font-display text-4xl tracking-tight md:text-5xl">{e.name}</h3>
              <p className="kicker mt-4">
                {fmtEventDate(e.startsAt)} · {fmtEventTime(e.startsAt)}
              </p>
            </div>
            <div className="md:col-span-5 md:pt-2">
              <p className="text-base font-medium">{e.venueName}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                {e.address}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {e.mapUrl && (
                  <a
                    href={e.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline underline-offset-4"
                    style={{ color: "var(--accent-2)" }}
                  >
                    View map ↗
                  </a>
                )}
                {e.dressCode && (
                  <span
                    className="kicker rounded-full px-3 py-1.5"
                    style={{ border: "1px solid var(--hairline)", letterSpacing: "0.22em" }}
                  >
                    Dress · {e.dressCode}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
