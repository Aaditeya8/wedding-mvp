import { SectionHeader } from "./SectionHeader";

/* Travel copy is real prose, not schema data — until a CMS field exists it
   lives here keyed by wedding slug, so no wedding shows another's hotels. */
const CONTENT: Record<string, { stays: { name: string; note: string }[]; gettingThere: string }> = {
  "ananya-weds-arjun": {
    stays: [
      {
        name: "Taj Lands End, Bandra",
        note: "Home of the Sangeet. A wedding block is reserved — mention the couple's names when booking.",
      },
      {
        name: "Grand Hyatt, Santacruz",
        note: "The Reception happens under this roof, and it is the closest comfortable stay to the airport.",
      },
    ],
    gettingThere:
      "Flying in? Land at Mumbai (BOM). Both hotels are 20–40 minutes from the terminals, " +
      "and the Pheras venue in Juhu is a fifteen-minute drive from either — leave buffer " +
      "for Mumbai traffic on the wedding morning.",
  },
  "gaurav-weds-karishma": {
    stays: [
      {
        name: "Taj Fateh Prakash Palace, Udaipur",
        note: "Home of the Reception, right on Lake Pichola. A wedding block is reserved — mention the couple's names when booking.",
      },
      {
        name: "The Leela Palace, Udaipur",
        note: "A short boat ride from the Pheras at Jagmandir. Shuttles run to both wedding-day venues.",
      },
    ],
    gettingThere:
      "The Delhi celebrations are at private venues — no stay needed. For the wedding days, " +
      "fly into Udaipur (UDR), thirty minutes from the lake. The Pheras at Jagmandir Island " +
      "are reached by boat from the City Palace jetty; departures start an hour before.",
  },
};

const FALLBACK = { stays: [], gettingThere: "" };

export function TravelStay({ slug }: { slug: string }) {
  const { stays, gettingThere } = CONTENT[slug] ?? FALLBACK;
  if (!stays.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no="03" title="Travel & Stay" />
      <div className="grid gap-6 md:grid-cols-2">
        {stays.map((s, i) => (
          <div
            key={s.name}
            className="reveal card-mount p-8"
            data-fx="scale"
            style={{ "--rd": `${i * 0.14}s` } as React.CSSProperties}
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
        {gettingThere}
      </p>
    </section>
  );
}
