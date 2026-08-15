const Diamond = () => (
  <svg viewBox="0 0 10 10" className="h-2 w-2 shrink-0" aria-hidden>
    <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="var(--accent)" />
  </svg>
);

/* Infinite event-name marquee band under the hero. The track renders twice
   (second copy aria-hidden) and the keyframe loops -50% for a seamless join. */
export function Marquee({ items }: { items: string[] }) {
  const Track = ({ hidden }: { hidden?: boolean }) => (
    <div aria-hidden={hidden} className="flex shrink-0 items-center">
      {items.map((it) => (
        <span key={it} className="flex items-center">
          <span className="kicker px-8 py-4 md:px-12" style={{ fontSize: "0.75rem" }}>
            {it}
          </span>
          <Diamond />
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee hairline-t hairline-b" role="presentation">
      <div className="marquee-track">
        <Track />
        <Track hidden />
      </div>
    </div>
  );
}
