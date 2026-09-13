"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ornament } from "@/themes/ornaments";
import { THEMES, THEME_META, type Theme } from "@/themes/catalog";

/* The product's claim is "one click restyles your whole wedding". Rather than
   describe it, run it: this is a real wedding site in miniature, built from the
   same theme contract (src/themes/tokens.css) the live sites use, so swapping
   data-theme restyles it exactly the way a couple's own site restyles. It
   cycles on its own until a visitor picks a swatch, then it's theirs. */

const RITES = [
  { name: "Mehendi", when: "Wed, 18 Nov · 4:00 pm" },
  { name: "Sangeet", when: "Thu, 19 Nov · 7:00 pm" },
  { name: "Pheras", when: "Fri, 20 Nov · 10:00 am" },
];

export function LivePreview() {
  const [theme, setTheme] = useState<Theme>("ivory-editorial");
  const [touched, setTouched] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  // Auto-cycle: only while it's on screen, only until someone interacts, and
  // never when the visitor has asked for less motion.
  useEffect(() => {
    if (touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = frame.current;
    if (!el) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setInterval(() => {
          setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
        }, 2600);
      } else if (!entry.isIntersecting && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    }, { threshold: 0.35 });

    io.observe(el);
    return () => { io.disconnect(); if (timer) clearInterval(timer); };
  }, [touched]);

  function choose(t: Theme) {
    setTouched(true);
    setTheme(t);
  }

  return (
    <div ref={frame} className="grid items-center gap-12 md:grid-cols-[auto_1fr] md:gap-16">
      <div className="justify-self-center">
        <div className="device">
          <span aria-hidden className="device-notch" />
          <div data-theme={theme} className="device-screen">
            {/* key replays the entrance animation on every theme change */}
            <div key={theme} className="device-fade flex h-full flex-col items-center px-5 pb-0 pt-12 text-center">
              <p className="kicker" style={{ fontSize: "0.5rem" }}>The wedding of</p>

              <h3 className="font-display mt-3 leading-[0.95] tracking-tight" style={{ fontSize: "2.35rem" }}>
                Ananya<br />
                <em className="foil italic">&amp;</em> Arjun
              </h3>

              <div className="mt-3 scale-75"><Ornament theme={theme} slot="hero" /></div>

              <p className="kicker mt-1" style={{ fontSize: "0.45rem" }}>20 November 2026 · Mumbai</p>

              <ul className="mt-5 w-full space-y-2.5 text-left">
                {RITES.map((r) => (
                  <li
                    key={r.name}
                    className="flex items-baseline justify-between gap-2 pb-2"
                    style={{ borderBottom: "1px solid var(--hairline)" }}
                  >
                    <span className="font-display" style={{ fontSize: "1.05rem" }}>{r.name}</span>
                    <span style={{ fontSize: "0.5rem", color: "var(--ink-soft)" }}>{r.when}</span>
                  </li>
                ))}
              </ul>

              <p
                className="font-display mt-5 px-1 text-center italic leading-snug"
                style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}
              >
                &ldquo;Matched by an aunty, ignored the aunty, then matched again by an app
                three years later.&rdquo;
              </p>

              <p className="mt-3" style={{ fontSize: "0.5rem", color: "var(--accent-2)" }}>
                #AnanyaKaArjun
              </p>

              <div
                className="mt-auto -mx-5 w-[calc(100%+2.5rem)] px-4 py-5"
                style={{ background: "var(--band-bg)", color: "var(--band-ink)" }}
              >
                <p className="kicker foil" style={{ fontSize: "0.45rem" }}>RSVP</p>
                <p className="font-display mt-1.5" style={{ fontSize: "0.95rem" }}>Will you be joining us?</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="kicker">Six looks, one click</p>
        <h2 className="font-display mt-4 text-4xl tracking-tight md:text-5xl">
          Try it on. The whole invitation changes.
        </h2>
        <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Not a mockup — that&apos;s the real thing, running the same palettes your site
          would. Tap a look to dress the invitation in it. Change your mind in April;
          every page and every invitation email follows along.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2.5 sm:max-w-lg">
          {THEMES.map((t) => {
            const m = THEME_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => choose(t)}
                aria-pressed={theme === t}
                className="swatch"
                style={{ background: m.bg, color: m.ink }}
              >
                <span className="block truncate" style={{ fontFamily: `${m.fontVar}, Georgia, serif`, fontSize: "1.15rem" }}>
                  A &amp; A
                </span>
                <span className="mt-1 block truncate text-[9px] uppercase tracking-[0.18em] opacity-70">
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs" style={{ color: "var(--ink-soft)" }}>
          Now showing <span style={{ color: "var(--ink)" }}>{THEME_META[theme].label}</span> — {THEME_META[theme].tagline.toLowerCase()}
        </p>

        <Link href="/start" className="cta mt-8">Start with this look</Link>
      </div>
    </div>
  );
}
