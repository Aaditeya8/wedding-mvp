export function SectionHeader({ no, title }: { no: string; title: string }) {
  return (
    <div className="reveal mb-12 flex items-baseline gap-5 hairline-b pb-4">
      <span className="font-display text-lg" style={{ color: "var(--accent)" }}>
        {no}
      </span>
      <h2 className="font-display text-3xl md:text-4xl tracking-tight">{title}</h2>
    </div>
  );
}
