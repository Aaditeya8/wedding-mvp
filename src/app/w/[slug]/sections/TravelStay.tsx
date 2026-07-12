import { SectionHeader } from "./SectionHeader";

const STAYS = [
  {
    name: "Taj Lands End, Bandra",
    note: "Home of the Sangeet. A wedding block is reserved — mention the couple's names when booking.",
  },
  {
    name: "Grand Hyatt, Santacruz",
    note: "The Reception happens under this roof, and it is the closest comfortable stay to the airport.",
  },
];

export function TravelStay({ theme: _theme }: { theme: string }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no="03" title="Travel & Stay" />
      <div className="grid gap-6 md:grid-cols-2">
        {STAYS.map((s) => (
          <div
            key={s.name}
            className="reveal p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
          >
            <p className="kicker">Stay</p>
            <h3 className="font-display mt-4 text-2xl md:text-3xl">{s.name}</h3>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              {s.note}
            </p>
          </div>
        ))}
      </div>
      <p className="reveal mt-10 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Flying in? Land at Mumbai (BOM). Both hotels are 20–40 minutes from the terminals,
        and the Pheras venue in Juhu is a fifteen-minute drive from either — leave buffer
        for Mumbai traffic on the wedding morning.
      </p>
    </section>
  );
}
