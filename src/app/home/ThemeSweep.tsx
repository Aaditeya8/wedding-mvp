"use client";

import { useEffect, useState } from "react";
import { THEMES, THEME_META, type Theme } from "@/themes/catalog";

/* The page wears the product. Each marketing section declares a theme in
   data-sweep; as it crosses the viewport's upper third the whole page is
   restyled through the same token contract a couple's own site uses. By
   the time a visitor reaches the footer they have seen all six looks
   without being shown a gallery of them.

   The attribute is written straight to the DOM: this runs on scroll, and
   the only React state is the small indicator that names the look. */
export function ThemeSweep({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    const root = document.getElementById("sweep");
    if (!root) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-sweep]"));
    if (!sections.length) return;

    // A section takes over once its top passes the line, but only by a
    // margin, and hands back only once it has fallen back past it by the
    // same margin. Without this dead band a boundary resting near the line
    // flipped the look back and forth on every small scroll.
    const PAD = 32;
    let cur = 0;
    let raf = 0;
    const pick = () => {
      raf = 0;
      const line = window.innerHeight * 0.38;
      let next = 0;
      sections.forEach((s, i) => {
        const edge = i <= cur ? line + PAD : line - PAD;
        if (s.getBoundingClientRect().top <= edge) next = i;
      });
      cur = next;
      const t = sections[cur].dataset.sweep as Theme;
      if (root.dataset.theme !== t) {
        root.dataset.theme = t;
        setTheme(t);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="sweep-pill" aria-live="polite">
      <span className="sweep-dots" aria-hidden>
        {THEMES.map((t) => (
          <span
            key={t}
            className="sweep-dot"
            data-on={t === theme}
            style={{ background: THEME_META[t].bg, borderColor: THEME_META[t].ink }}
          />
        ))}
      </span>
      <span className="sweep-label">
        This page is wearing <b>{THEME_META[theme].label}</b>
      </span>
    </div>
  );
}
