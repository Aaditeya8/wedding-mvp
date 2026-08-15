import type { JSX } from "react";

type Slot = "hero" | "divider";

/* Per-theme decorative SVG, keyed by theme + slot. Sections render
   <Ornament theme={theme} slot="..."/> and never know which theme is live. */

/* ---- ivory-editorial: hairlines + a single marigold diamond ---- */

function IvoryHero() {
  return (
    <svg viewBox="0 0 240 24" className="mx-auto h-6 w-60" aria-hidden fill="none">
      <line x1="0" y1="12" x2="102" y2="12" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
      <rect x="114" y="6" width="12" height="12" transform="rotate(45 120 12)" fill="var(--accent)" />
      <line x1="138" y1="12" x2="240" y2="12" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
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
        pathLength={1}
        stroke="var(--accent)"
        strokeWidth="2"
      />
      {/* finial */}
      <circle cx="140" cy="2" r="2.5" fill="var(--accent)" />
      {/* flanking hairlines */}
      <line x1="0" y1="52" x2="280" y2="52" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
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
          pathLength={1}
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
        pathLength={1}
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
      <path d="M20 9 Q 30 15 40 9" pathLength={1} stroke="var(--hairline)" strokeWidth="1.2" />
      <path d="M80 9 Q 90 15 100 9" pathLength={1} stroke="var(--hairline)" strokeWidth="1.2" />
      <circle cx="60" cy="9" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

/* ---- mehfil-noor: chandbali crescent with hanging pearls, star dust ---- */

function MehfilHero() {
  const pearls = [
    { x: 104, len: 10 }, { x: 122, len: 15 }, { x: 140, len: 18 }, { x: 158, len: 15 }, { x: 176, len: 10 },
  ];
  return (
    <svg viewBox="0 0 280 56" className="mx-auto h-12 w-72" aria-hidden fill="none">
      {/* chandbali crescent, open side up */}
      <path
        d="M92 14 C 100 34 118 44 140 44 C 162 44 180 34 188 14 C 178 28 160 34 140 34 C 120 34 102 28 92 14 Z"
        pathLength={1}
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      {/* hanging pearl drops */}
      {pearls.map((p) => (
        <g key={p.x}>
          <line x1={p.x} y1={40} x2={p.x} y2={40 + p.len - 4} pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
          <circle cx={p.x} cy={40 + p.len} r="1.8" fill="var(--accent)" />
        </g>
      ))}
      {/* gold finial star + flanking star dust */}
      <path d="M140 4 L 142 9 L 147 11 L 142 13 L 140 18 L 138 13 L 133 11 L 138 9 Z" fill="var(--accent-2)" />
      <circle cx="52" cy="18" r="1.4" fill="var(--accent)" opacity="0.8" />
      <circle cx="70" cy="8" r="1" fill="var(--accent)" opacity="0.55" />
      <circle cx="228" cy="18" r="1.4" fill="var(--accent)" opacity="0.8" />
      <circle cx="210" cy="8" r="1" fill="var(--accent)" opacity="0.55" />
    </svg>
  );
}

function MehfilDivider() {
  return (
    <svg viewBox="0 0 120 14" className="mx-auto h-3.5 w-28" aria-hidden fill="none">
      <path d="M60 1 L 61.8 5.2 L 66 7 L 61.8 8.8 L 60 13 L 58.2 8.8 L 54 7 L 58.2 5.2 Z" fill="var(--accent-2)" />
      <circle cx="38" cy="7" r="1.5" fill="var(--accent)" opacity="0.8" />
      <circle cx="82" cy="7" r="1.5" fill="var(--accent)" opacity="0.8" />
      <circle cx="22" cy="7" r="1" fill="var(--accent)" opacity="0.45" />
      <circle cx="98" cy="7" r="1" fill="var(--accent)" opacity="0.45" />
    </svg>
  );
}

/* ---- pichwai-bagh: stroke-drawn lotus between leaf sprigs ---- */

function PichwaiHero() {
  return (
    <svg viewBox="0 0 280 56" className="mx-auto h-12 w-72" aria-hidden fill="none">
      {/* lotus petals, centre outward */}
      <path d="M140 10 C 134 22 134 34 140 44 C 146 34 146 22 140 10 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M122 18 C 122 30 128 40 140 44 C 136 34 132 24 122 18 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.4" />
      <path d="M158 18 C 158 30 152 40 140 44 C 144 34 148 24 158 18 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.4" />
      <path d="M106 28 C 110 38 122 44 140 44 C 128 40 116 36 106 28 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.2" opacity="0.8" />
      <path d="M174 28 C 170 38 158 44 140 44 C 152 40 164 36 174 28 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.2" opacity="0.8" />
      <circle cx="140" cy="44" r="2.4" fill="var(--accent-2)" />
      {/* leaf sprigs flanking */}
      <path d="M52 46 Q 66 30 84 34 Q 72 46 52 46 Z" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.2" />
      <path d="M228 46 Q 214 30 196 34 Q 208 46 228 46 Z" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.2" />
      <line x1="84" y1="34" x2="98" y2="42" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
      <line x1="196" y1="34" x2="182" y2="42" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
    </svg>
  );
}

function PichwaiDivider() {
  return (
    <svg viewBox="0 0 120 16" className="mx-auto h-4 w-28" aria-hidden fill="none">
      {/* lotus bud between leaf strokes */}
      <path d="M60 2 C 56 7 56 11 60 14 C 64 11 64 7 60 2 Z" pathLength={1} stroke="var(--accent)" strokeWidth="1.3" />
      <path d="M24 12 Q 36 4 48 10" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.1" />
      <path d="M96 12 Q 84 4 72 10" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.1" />
      <circle cx="60" cy="14" r="1.4" fill="var(--accent-2)" />
    </svg>
  );
}

/* ---- neel-chhapa: hand-stamped booti row, deliberately imperfect ---- */

function NeelHero() {
  // slight per-stamp rotation drift = hand-block irregularity
  const stamps = [
    { x: 70, tilt: -4, madder: false }, { x: 105, tilt: 3, madder: true },
    { x: 140, tilt: 0, madder: false }, { x: 175, tilt: -3, madder: true },
    { x: 210, tilt: 4, madder: false },
  ];
  return (
    <svg viewBox="0 0 280 44" className="mx-auto h-10 w-72" aria-hidden fill="none">
      <line x1="8" y1="22" x2="48" y2="22" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
      <line x1="232" y1="22" x2="272" y2="22" pathLength={1} stroke="var(--hairline)" strokeWidth="1" />
      {stamps.map((s) => (
        <g key={s.x} transform={`rotate(${s.tilt} ${s.x} 22)`}>
          <rect
            x={s.x - 8} y={14} width={16} height={16}
            transform={`rotate(45 ${s.x} 22)`}
            pathLength={1}
            stroke={s.madder ? "var(--accent-2)" : "var(--accent)"}
            strokeWidth="1.4"
            fill={s.madder ? "var(--accent-2)" : "var(--accent)"}
            fillOpacity={s.x === 140 ? 0.85 : 0.12}
          />
          <circle cx={s.x} cy={22} r="1.6" fill={s.x === 140 ? "var(--bg)" : s.madder ? "var(--accent-2)" : "var(--accent)"} />
        </g>
      ))}
    </svg>
  );
}

function NeelDivider() {
  return (
    <svg viewBox="0 0 120 14" className="mx-auto h-3.5 w-28" aria-hidden fill="none">
      <g transform="rotate(-3 60 7)">
        <rect x="55" y="2" width="10" height="10" transform="rotate(45 60 7)" fill="var(--accent)" />
      </g>
      <g transform="rotate(4 34 7)">
        <rect x="30.5" y="3.5" width="7" height="7" transform="rotate(45 34 7)" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.2" />
      </g>
      <g transform="rotate(-4 86 7)">
        <rect x="82.5" y="3.5" width="7" height="7" transform="rotate(45 86 7)" pathLength={1} stroke="var(--accent-2)" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

const ORNAMENTS: Record<string, Record<Slot, () => JSX.Element>> = {
  "ivory-editorial": { hero: IvoryHero, divider: IvoryDivider },
  "raj-mahal": { hero: RajHero, divider: RajDivider },
  "gulaab-rococo": { hero: GulaabHero, divider: GulaabDivider },
  "mehfil-noor": { hero: MehfilHero, divider: MehfilDivider },
  "pichwai-bagh": { hero: PichwaiHero, divider: PichwaiDivider },
  "neel-chhapa": { hero: NeelHero, divider: NeelDivider },
};

export function Ornament({
  theme,
  slot,
  anim,
}: {
  theme: string;
  slot: Slot;
  /* "load" draws strokes on page load, "scroll" waits for ScrollFx's observer */
  anim?: "load" | "scroll";
}) {
  const set = ORNAMENTS[theme] ?? ORNAMENTS["ivory-editorial"];
  const Cmp = set[slot];
  if (!anim) return <Cmp />;
  return (
    <span className={anim === "load" ? "draw-load block" : "draw block"}>
      <Cmp />
    </span>
  );
}
