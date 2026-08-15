export function SectionHeader({ no, title }: { no: string; title: string }) {
  return (
    <div className="reveal mb-12" data-fx="left">
      <div className="flex items-baseline gap-5 pb-4">
        <span className="font-display text-lg" style={{ color: "var(--accent)" }}>
          {no}
        </span>
        <h2 className="font-display text-3xl md:text-4xl tracking-tight">{title}</h2>
      </div>
      {/* tapered rule fades to nothing — can't double up with row hairlines */}
      <div className="rule-taper" aria-hidden />
    </div>
  );
}
