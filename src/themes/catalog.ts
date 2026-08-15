/* App-facing theme catalog — single source for pickers, actions, and scripts.
   The DB enum in src/db/schema.ts must stay a literal for drizzle-kit; keep the
   two lists in sync when adding a theme. */

export const THEMES = [
  "ivory-editorial",
  "raj-mahal",
  "gulaab-rococo",
  "mehfil-noor",
  "pichwai-bagh",
  "neel-chhapa",
] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_META: Record<Theme, {
  label: string;
  tagline: string;
  bg: string;
  ink: string;
  dots: [string, string, string];
  fontVar: string;
}> = {
  "ivory-editorial": {
    label: "Ivory Editorial",
    tagline: "Modern minimal — quiet luxury",
    bg: "#faf8f4", ink: "#232323",
    dots: ["#faf8f4", "#232323", "#e8930c"],
    fontVar: "var(--font-instrument)",
  },
  "raj-mahal": {
    label: "Raj Mahal",
    tagline: "Royal heritage — maroon & gold",
    bg: "#2a0a10", ink: "#f5ead6",
    dots: ["#2a0a10", "#d4a439", "#1c2145"],
    fontVar: "var(--font-cormorant)",
  },
  "gulaab-rococo": {
    label: "Gulaab Rococo",
    tagline: "Romantic — blush & rani pink",
    bg: "#fdf2f6", ink: "#4a2b3a",
    dots: ["#fdf2f6", "#c2447a", "#8b7ab8"],
    fontVar: "var(--font-fraunces)",
  },
  "mehfil-noor": {
    label: "Mehfil-e-Noor",
    tagline: "Moonlit mehfil — midnight & silver",
    bg: "#0d1220", ink: "#e8ecf7",
    dots: ["#0d1220", "#a9bce0", "#d3aa5e"],
    fontVar: "var(--font-marcellus)",
  },
  "pichwai-bagh": {
    label: "Pichwai Bagh",
    tagline: "Painted garden — emerald & lotus",
    bg: "#0e2b22", ink: "#f1e9d6",
    dots: ["#0e2b22", "#e08cb2", "#c9a145"],
    fontVar: "var(--font-rozha)",
  },
  "neel-chhapa": {
    label: "Neel Chhapa",
    tagline: "Block print — porcelain & indigo",
    bg: "#f6f6f0", ink: "#22335e",
    dots: ["#f6f6f0", "#31509f", "#b8492d"],
    fontVar: "var(--font-prata)",
  },
};
