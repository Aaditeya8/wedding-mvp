import type { JSX } from "react";

type Slot = "hero" | "divider";

/* Per-theme decorative SVG, keyed by theme + slot. Sections render
   <Ornament theme={theme} slot="..."/> and never know which theme is live. */

/* ---- ivory-editorial: hairlines + a single marigold diamond ---- */

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

/* ---- raj-mahal: Mughal cusped arch + jaali lattice strip ---- */

function RajHero() {
  return (
    <svg viewBox="0 0 280 56" className="mx-auto h-12 w-72" aria-hidden fill="none">
      {/* cusped (scalloped) Mughal arch */}
      <path
        d="M40 52 V 34 C 40 30 44 28 46 30 C 48 24 54 24 56 28 C 58 20 66 20 68 26 C 72 14 84 10 96 10
           C 104 6 112 2 140 2 C 168 2 176 6 184 10 C 196 10 208 14 212 26 C 214 20 222 20 224 28
           C 226 24 232 24 234 30 C 236 28 240 30 240 34 V 52"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      {/* finial */}
      <circle cx="140" cy="2" r="2.5" fill="var(--accent)" />
      {/* flanking hairlines */}
      <line x1="0" y1="52" x2="280" y2="52" stroke="var(--hairline)" strokeWidth="1" />
      <rect x="20" y="44" width="8" height="8" transform="rotate(45 24 48)" fill="var(--accent-2)" opacity="0.8" />
      <rect x="252" y="44" width="8" height="8" transform="rotate(45 256 48)" fill="var(--accent-2)" opacity="0.8" />
    </svg>
  );
}

function RajDivider() {
  const diamonds = [0, 1, 2, 3, 4, 5, 6];
  return (
    <svg viewBox="0 0 168 16" className="mx-auto h-4 w-40" aria-hidden fill="none">
      {diamonds.map((i) => (
        <rect
          key={i}
          x={12 + i * 22}
          y={4}
          width={8}
          height={8}
          transform={`rotate(45 ${16 + i * 22} 8)`}
          stroke="var(--accent)"
          strokeWidth="1"
          fill={i === 3 ? "var(--accent)" : "none"}
        />
      ))}
    </svg>
  );
}

/* ---- gulaab-rococo: scalloped arc + soft watercolour blooms ---- */

function GulaabHero() {
  return (
    <svg viewBox="0 0 280 56" className="mx-auto h-14 w-80" aria-hidden fill="none">
      <defs>
        <filter id="glb" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      {/* scalloped garland arc */}
      <path
        d="M20 20 Q 35 38 50 20 Q 65 38 80 20 Q 95 38 110 20 Q 125 38 140 20 Q 155 38 170 20 Q 185 38 200 20 Q 215 38 230 20 Q 245 38 260 20"
        stroke="var(--accent)"
        strokeWidth="2.2"
      />
      {/* watercolour blooms at the ends and centre */}
      <g filter="url(#glb)">
        <circle cx="20" cy="20" r="11" fill="var(--accent)" opacity="0.5" />
        <circle cx="30" cy="26" r="7" fill="var(--accent-2)" opacity="0.5" />
        <circle cx="260" cy="20" r="11" fill="var(--accent)" opacity="0.5" />
        <circle cx="250" cy="26" r="7" fill="var(--accent-2)" opacity="0.5" />
        <circle cx="140" cy="17" r="13" fill="var(--accent)" opacity="0.55" />
        <circle cx="128" cy="25" r="7" fill="var(--accent-2)" opacity="0.55" />
        <circle cx="152" cy="25" r="7" fill="var(--accent-2)" opacity="0.55" />
      </g>
      <circle cx="140" cy="19" r="3" fill="var(--accent)" />
      <circle cx="20" cy="20" r="2.2" fill="var(--accent)" />
      <circle cx="260" cy="20" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

function GulaabDivider() {
  return (
    <svg viewBox="0 0 120 18" className="mx-auto h-4 w-28" aria-hidden fill="none">
      <defs>
        <filter id="glbd" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g filter="url(#glbd)">
        <circle cx="60" cy="9" r="6" fill="var(--accent)" opacity="0.55" />
        <circle cx="52" cy="12" r="3.5" fill="var(--accent-2)" opacity="0.5" />
        <circle cx="68" cy="12" r="3.5" fill="var(--accent-2)" opacity="0.5" />
      </g>
      <path d="M20 9 Q 30 15 40 9" stroke="var(--hairline)" strokeWidth="1.2" />
      <path d="M80 9 Q 90 15 100 9" stroke="var(--hairline)" strokeWidth="1.2" />
      <circle cx="60" cy="9" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

const ORNAMENTS: Record<string, Record<Slot, () => JSX.Element>> = {
  "ivory-editorial": { hero: IvoryHero, divider: IvoryDivider },
  "raj-mahal": { hero: RajHero, divider: RajDivider },
  "gulaab-rococo": { hero: GulaabHero, divider: GulaabDivider },
};

export function Ornament({ theme, slot }: { theme: string; slot: Slot }) {
  const set = ORNAMENTS[theme] ?? ORNAMENTS["ivory-editorial"];
  const Cmp = set[slot];
  return <Cmp />;
}
