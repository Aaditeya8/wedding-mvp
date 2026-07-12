import { SectionHeader } from "./SectionHeader";

const PLATES = [
  { src: "/gallery/marigold-garland.svg", alt: "Marigold garland illustration", tall: true },
  { src: "/gallery/paisley.svg", alt: "Paisley motif illustration", tall: false },
  { src: "/gallery/mandap.svg", alt: "Mandap arch illustration", tall: true },
  { src: "/gallery/jhumka.svg", alt: "Jhumka earring illustration", tall: true },
  { src: "/gallery/mandala.svg", alt: "Mandala dot-work illustration", tall: false },
  { src: "/gallery/lotus.svg", alt: "Lotus illustration", tall: true },
];

export function Gallery({ theme: _theme }: { theme: string }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no="04" title="Gallery" />
      <div className="columns-2 gap-4 md:columns-3 md:gap-6 [&>img]:mb-4 md:[&>img]:mb-6">
        {PLATES.map((p) => (
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            width={600}
            height={p.tall ? 780 : 600}
            loading="lazy"
            className="reveal w-full"
            style={{ border: "1px solid var(--hairline)" }}
          />
        ))}
      </div>
      <p className="reveal kicker mt-8 text-center">Photographs arrive after the haldi</p>
    </section>
  );
}
