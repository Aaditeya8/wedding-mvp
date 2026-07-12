"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTheme } from "./actions";

type Theme = "ivory-editorial" | "raj-mahal" | "gulaab-rococo";

const SWATCHES: {
  theme: Theme;
  label: string;
  tagline: string;
  bg: string;
  ink: string;
  dots: string[];
  fontVar: string;
}[] = [
  {
    theme: "ivory-editorial",
    label: "Ivory Editorial",
    tagline: "Modern minimal — quiet luxury",
    bg: "#faf8f4",
    ink: "#232323",
    dots: ["#faf8f4", "#232323", "#e8930c"],
    fontVar: "var(--font-instrument)",
  },
  {
    theme: "raj-mahal",
    label: "Raj Mahal",
    tagline: "Royal heritage — maroon & gold",
    bg: "#2a0a10",
    ink: "#f5ead6",
    dots: ["#2a0a10", "#d4a439", "#1c2145"],
    fontVar: "var(--font-cormorant)",
  },
  {
    theme: "gulaab-rococo",
    label: "Gulaab Rococo",
    tagline: "Romantic — blush & rani pink",
    bg: "#fdf2f6",
    ink: "#4a2b3a",
    dots: ["#fdf2f6", "#c2447a", "#8b7ab8"],
    fontVar: "var(--font-fraunces)",
  },
];

export function ThemeSwitcher({
  weddingId,
  current,
  slug,
  coupleNames,
}: {
  weddingId: string;
  current: Theme;
  slug: string;
  coupleNames: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Theme>(current);
  const [pending, startTransition] = useTransition();

  function choose(theme: Theme) {
    if (theme === active || pending) return;
    const prev = active;
    setActive(theme); // optimistic — the swatch highlights instantly
    startTransition(async () => {
      const res = await setTheme({ theme, weddingId });
      if (!res.ok) setActive(prev);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold">Your look</h2>
          <p className="mt-1 text-sm text-neutral-500">
            One click restyles your whole site — invitations follow the same palette.
          </p>
        </div>
        <a
          href={`/w/${slug}`}
          target="_blank"
          className="text-sm text-neutral-600 underline underline-offset-4"
        >
          View your site ↗
        </a>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {SWATCHES.map((s) => {
          const selected = active === s.theme;
          return (
            <button
              key={s.theme}
              type="button"
              onClick={() => choose(s.theme)}
              aria-pressed={selected}
              className={`group relative overflow-hidden rounded-lg border p-5 text-left transition-all ${
                selected
                  ? "border-neutral-900 shadow-[0_0_0_2px_rgba(23,23,23,1)]"
                  : "border-neutral-200 hover:border-neutral-400 hover:shadow-md"
              }`}
              style={{ background: s.bg, color: s.ink }}
            >
              <p
                className="text-3xl leading-tight tracking-tight"
                style={{ fontFamily: `${s.fontVar}, Georgia, serif` }}
              >
                {coupleNames}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.25em] opacity-70">
                {s.label}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {s.dots.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="text-[11px] opacity-70">
                  {selected ? (pending ? "applying…" : "✓ live") : "preview"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-neutral-400">{SWATCHES.find((s) => s.theme === active)?.tagline}</p>
    </section>
  );
}
