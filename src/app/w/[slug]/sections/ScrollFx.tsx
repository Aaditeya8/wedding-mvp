"use client";

import { useEffect } from "react";

/* Arms the scroll effects: html.fx unlocks the hidden states in globals.css,
   IntersectionObserver flips .is-in per element (works in every browser —
   the old animation-timeline:view() approach silently no-ops off-Chrome),
   and one rAF scroll handler feeds --py to the hero parallax watermark. */
export function ScrollFx() {
  useEffect(() => {
    document.documentElement.classList.add("fx");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    document.querySelectorAll(".reveal, .draw, .rule-grow").forEach((el) => io.observe(el));

    const parallax = document.querySelector<HTMLElement>(".parallax");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        parallax?.style.setProperty("--py", `${window.scrollY * 0.22}px`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return null;
}
