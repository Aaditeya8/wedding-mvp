import type { JSX } from "react";

type Slot = "hero" | "divider";

/* Per-theme decorative SVG, keyed by theme + slot. Sections render
   <Ornament theme={theme} slot="..."/> and never know which theme is live. */

function IvoryHero() {
  return (
    <svg viewBox="0 0 240 24" className="mx-auto h-6 w-60" aria-hidden fill="none">
      <line x1="0" y1="12" x2="102" y2="12" stroke="var(--hairline)" strokeWidth="1" />
      <rect x="114" y="6" width="12" height="12" transform="rotate(45 120 12)" fill="var(--accent)" />
      <line x1="138" y1="12" x2="240" y2="12" stroke="var(--hairline)" strokeWidth="1" />
    </svg>
  );
}

function IvoryDivider() {
  return (
    <svg viewBox="0 0 120 12" className="mx-auto h-3 w-28" aria-hidden fill="none">
      <circle cx="60" cy="6" r="3" fill="var(--accent)" />
      <circle cx="44" cy="6" r="1.5" fill="var(--hairline)" />
      <circle cx="76" cy="6" r="1.5" fill="var(--hairline)" />
    </svg>
  );
}

const ORNAMENTS: Record<string, Record<Slot, () => JSX.Element>> = {
  "ivory-editorial": { hero: IvoryHero, divider: IvoryDivider },
  // raj-mahal / gulaab-rococo ornaments land with the theme task
  "raj-mahal": { hero: IvoryHero, divider: IvoryDivider },
  "gulaab-rococo": { hero: IvoryHero, divider: IvoryDivider },
};

export function Ornament({ theme, slot }: { theme: string; slot: Slot }) {
  const set = ORNAMENTS[theme] ?? ORNAMENTS["ivory-editorial"];
  const Cmp = set[slot];
  return <Cmp />;
}
